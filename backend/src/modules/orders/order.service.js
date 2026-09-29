import { pool } from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';
import { priceBreakdown, round2 } from '../../utils/money.js';
import { composeAddress, haversineKm, mapsDirectionUrl } from '../../utils/geo.js';
import { parseSqlDate, todaySql } from '../../utils/dates.js';
import { getSettingsMap } from '../../services/settingsService.js';
import { notifyAdmins, notifyUser } from '../../services/notificationService.js';
import { emitLocation, emitOrder } from '../../services/socket.js';
import {
  sendBookingConfirmation,
  sendPaymentReceipt,
  sendServiceCompletedEmail,
  sendServiceStartedEmail,
  sendTechnicianAssignedEmail,
  sendTechnicianOnTheWayEmail,
} from '../../services/emailService.js';
import { recalculateIncentives } from '../../services/incentiveService.js';
import {
  ORDER_FROM,
  ORDER_SELECT,
  customerByUser,
  findOrderById,
  presentOrder,
  technicianByUser,
} from './order.model.js';

const ACTIVE = ['confirmed', 'assigned', 'accepted', 'on_the_way', 'arrived', 'service_started'];
const DONE = ['service_completed', 'payment_completed'];
const CLOSED = ['cancelled', 'refunded', 'rejected'];
const TECH_NEXT = {
  assigned: ['accepted', 'rejected'],
  accepted: ['on_the_way'],
  on_the_way: ['arrived'],
  arrived: ['service_started'],
  service_started: ['service_completed'],
  service_completed: ['payment_completed'],
};

function safeLike(value) {
  return `%${String(value).replace(/[%_]/g, '').trim()}%`;
}

export async function resolveTechnicianCost(technicianId, serviceId) {
  if (technicianId) {
    const [exact] = await pool.query(
      `SELECT cost FROM technician_costs
       WHERE technician_id = ? AND service_id = ? AND status = 'active' AND effective_date <= CURDATE()
       ORDER BY effective_date DESC LIMIT 1`,
      [technicianId, serviceId],
    );
    if (exact[0]) return Number(exact[0].cost);
    const [tech] = await pool.query('SELECT level_id FROM technicians WHERE id = ?', [technicianId]);
    if (tech[0]?.level_id) {
      const [levelCost] = await pool.query(
        `SELECT cost FROM technician_costs
         WHERE technician_id IS NULL AND level_id = ? AND service_id = ? AND status = 'active' AND effective_date <= CURDATE()
         ORDER BY effective_date DESC LIMIT 1`,
        [tech[0].level_id, serviceId],
      );
      if (levelCost[0]) return Number(levelCost[0].cost);
    }
  }
  const [service] = await pool.query('SELECT technician_cost FROM services WHERE id = ?', [serviceId]);
  return Number(service[0]?.technician_cost || 0);
}

export function marginFor(order, technicianCost = order.technician_cost, otherCosts = order.other_costs) {
  return round2(Number(order.total_amount) - Number(technicianCost) - Number(order.discount) - Number(otherCosts || 0));
}

async function jobsOnDate(technicianId, date) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS cnt FROM orders
     WHERE technician_id = ? AND scheduled_date = ?
       AND order_status NOT IN ('cancelled', 'rejected', 'refunded')`,
    [technicianId, date],
  );
  return Number(rows[0].cnt || 0);
}

async function addHistory(conn, orderId, status, note, userId) {
  await conn.query(
    'INSERT INTO order_status_history (order_id, status, note, changed_by) VALUES (?, ?, ?, ?)',
    [orderId, status, note, userId || null],
  );
}

async function insertPayment(conn, { orderId, customerId, amount, method, status }) {
  const transactionId = status === 'paid' ? `TXN${Date.now()}${orderId}` : null;
  const paidAt = status === 'paid' ? new Date() : null;
  const [result] = await conn.query(
    `INSERT INTO payments (order_id, customer_id, amount, method, status, transaction_id, gateway_ref, paid_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [orderId, customerId, amount, method, status, transactionId, status === 'paid' ? 'RECORDED' : null, paidAt],
  );
  return { id: result.insertId, amount, method, status, transaction_id: transactionId, paid_at: paidAt };
}

function assertViewer(order, user) {
  if (user.role === 'ADMIN') return;
  if (user.role === 'CUSTOMER' && order.customer_user_id === user.id) return;
  if (user.role === 'TECHNICIAN' && order.technician_user_id === user.id) return;
  throw new ApiError(403, 'You cannot view this order', 'FORBIDDEN');
}

async function mailSafe(fn) {
  try {
    await fn();
  } catch (error) {
    console.error('[email]', error.message);
  }
}

export async function listOrders(filters, user) {
  const where = ['1=1'];
  const params = [];
  if (user.role === 'CUSTOMER') {
    const customer = await customerByUser(user.id);
    where.push('o.customer_id = ?');
    params.push(customer?.id || 0);
  } else if (user.role === 'TECHNICIAN') {
    const tech = await technicianByUser(user.id);
    where.push('o.technician_id = ?');
    params.push(tech?.id || 0);
  }
  if (filters.customerId && user.role === 'ADMIN') {
    where.push('o.customer_id = ?');
    params.push(filters.customerId);
  }
  if (filters.technicianId && user.role === 'ADMIN') {
    where.push('o.technician_id = ?');
    params.push(filters.technicianId);
  }
  if (filters.serviceId) {
    where.push('o.service_id = ?');
    params.push(filters.serviceId);
  }
  if (filters.status) {
    where.push('o.order_status = ?');
    params.push(filters.status);
  }
  if (filters.payment) {
    where.push('o.payment_status = ?');
    params.push(filters.payment);
  }
  if (filters.bucket === 'active') {
    where.push(`o.order_status IN (${ACTIVE.map(() => '?').join(',')})`);
    params.push(...ACTIVE);
  } else if (filters.bucket === 'completed') {
    where.push(`o.order_status IN (${DONE.map(() => '?').join(',')})`);
    params.push(...DONE);
  } else if (filters.bucket === 'cancelled') {
    where.push(`o.order_status IN (${CLOSED.map(() => '?').join(',')})`);
    params.push(...CLOSED);
  } else if (filters.bucket === 'pending') {
    where.push("o.order_status IN ('pending','confirmed')");
  }
  if (filters.from) {
    where.push('o.scheduled_date >= ?');
    params.push(filters.from);
  }
  if (filters.to) {
    where.push('o.scheduled_date <= ?');
    params.push(filters.to);
  }
  if (filters.search) {
    const q = safeLike(filters.search);
    where.push('(o.order_number LIKE ? OR u.name LIKE ? OR u.phone LIKE ? OR s.name LIKE ? OR IFNULL(tu.name, \'\') LIKE ?)');
    params.push(q, q, q, q, q);
  }
  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(filters.limit) || 10));
  const offset = (page - 1) * limit;
  const whereSql = where.join(' AND ');
  const [countRows] = await pool.query(`SELECT COUNT(*) AS total ${ORDER_FROM} WHERE ${whereSql}`, params);
  const [rows] = await pool.query(
    `${ORDER_SELECT} WHERE ${whereSql} ORDER BY o.created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  return {
    items: rows.map((row) => ({
      ...presentOrder(row, user.role),
      maps_url: mapsDirectionUrl(row.latitude, row.longitude),
    })),
    page,
    limit,
    total: Number(countRows[0].total || 0),
  };
}

export async function getOrder(id, user) {
  const order = await findOrderById(id);
  if (!order) throw new ApiError(404, 'Order not found', 'ORDER_NOT_FOUND');
  assertViewer(order, user);
  const [history] = await pool.query(
    `SELECT h.*, u.name AS changed_by_name
     FROM order_status_history h
     LEFT JOIN users u ON u.id = h.changed_by
     WHERE h.order_id = ?
     ORDER BY h.id ASC`,
    [id],
  );
  const [images] = await pool.query('SELECT id, image_path, created_at FROM order_images WHERE order_id = ?', [id]);
  const [payments] = await pool.query('SELECT * FROM payments WHERE order_id = ? ORDER BY id DESC', [id]);
  const [review] = await pool.query('SELECT * FROM reviews WHERE order_id = ?', [id]);
  return {
    ...presentOrder(order, user.role),
    maps_url: mapsDirectionUrl(order.latitude, order.longitude),
    history,
    images,
    payments: user.role === 'TECHNICIAN' ? payments.map(({ gateway_ref, ...rest }) => rest) : payments,
    review: review[0] || null,
  };
}

export async function createOrder(user, body) {
  const customer = await customerByUser(user.id);
  if (!customer) throw new ApiError(404, 'Customer profile not found', 'CUSTOMER_NOT_FOUND');
  const [services] = await pool.query(
    `SELECT * FROM services WHERE id = ? AND status = 'active' AND is_available = 1`,
    [body.serviceId],
  );
  const service = services[0];
  if (!service) throw new ApiError(400, 'This service is not available for booking', 'SERVICE_UNAVAILABLE');

  const settings = await getSettingsMap();
  const scheduled = parseSqlDate(`${body.scheduledDate} ${body.scheduledTime}`);
  if (!scheduled || Number.isNaN(scheduled.getTime())) {
    throw new ApiError(422, 'Choose a valid date and time', 'INVALID_SCHEDULE');
  }
  const lead = Number(settings.min_booking_lead_hours || 1);
  if ((scheduled.getTime() - Date.now()) / 36e5 < lead) {
    throw new ApiError(422, `Please book at least ${lead} hour(s) ahead`, 'BOOKING_TOO_SOON');
  }

  const addr = body.address || {};
  const latitude = Number(addr.latitude);
  const longitude = Number(addr.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new ApiError(422, 'Confirm the exact service location', 'LOCATION_REQUIRED');
  }
  if (!addr.city || !addr.state || !addr.pincode) {
    throw new ApiError(422, 'City, state, and pincode are required', 'ADDRESS_REQUIRED');
  }

  const technicianCost = await resolveTechnicianCost(null, service.id);
  const prices = priceBreakdown({
    basePrice: service.base_price,
    discountAmount: service.discount_amount,
    discountPercent: service.discount_percent,
    taxPercent: service.tax_percent,
    technicianCost,
  });
  const addressLine = composeAddress(addr) || `${addr.city}, ${addr.state}`;
  const method = ['cash', 'upi', 'card', 'online', 'other'].includes(body.paymentMethod) ? body.paymentMethod : 'cash';
  const payNow = Boolean(body.payNow) && method !== 'cash';

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    let addressId = body.addressId || null;
    if (body.saveAddress) {
      if (addr.isDefault) {
        await conn.query('UPDATE customer_addresses SET is_default = 0 WHERE customer_id = ?', [customer.id]);
      }
      const [address] = await conn.query(
        `INSERT INTO customer_addresses
          (customer_id, label, house_no, street, area, city, state, pincode, landmark, latitude, longitude, is_default)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [customer.id, addr.label || 'Home', addr.houseNo || null, addr.street || null, addr.area || null, addr.city, addr.state, addr.pincode, addr.landmark || null, latitude, longitude, addr.isDefault ? 1 : 0],
      );
      addressId = address.insertId;
    }
    const [result] = await conn.query(
      `INSERT INTO orders (
        order_number, customer_id, service_id, address_id, house_no, street, area, address_line, landmark,
        city, state, pincode, latitude, longitude, scheduled_date, scheduled_time, notes,
        subtotal, discount, tax, total_amount, technician_cost, other_costs, admin_margin,
        payment_method, payment_status, order_status
      ) VALUES ('PENDING', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 'confirmed')`,
      [
        customer.id, service.id, addressId, addr.houseNo || null, addr.street || null, addr.area || null, addressLine,
        addr.landmark || null, addr.city, addr.state, addr.pincode, latitude, longitude,
        body.scheduledDate, body.scheduledTime.length === 5 ? `${body.scheduledTime}:00` : body.scheduledTime,
        body.notes || null, prices.subtotal, prices.discount, prices.tax, prices.total, prices.technicianCost,
        prices.adminMargin, method, payNow ? 'paid' : 'unpaid',
      ],
    );
    const orderId = result.insertId;
    const orderNumber = `ORD-${10000 + orderId}`;
    await conn.query('UPDATE orders SET order_number = ? WHERE id = ?', [orderNumber, orderId]);
    await conn.query(
      `INSERT INTO order_items (order_id, service_id, quantity, unit_price, discount, tax, total)
       VALUES (?, ?, 1, ?, ?, ?, ?)`,
      [orderId, service.id, prices.subtotal, prices.discount, prices.tax, prices.total],
    );
    await addHistory(conn, orderId, 'pending', 'Booking created', user.id);
    await addHistory(conn, orderId, 'confirmed', 'Order confirmed', user.id);
    let payment = null;
    if (payNow) {
      payment = await insertPayment(conn, {
        orderId, customerId: customer.id, amount: prices.total, method, status: 'paid',
      });
    }
    await conn.commit();
    const order = await findOrderById(orderId);
    await notifyUser({
      userId: user.id,
      title: 'Booking confirmed',
      message: `${order.order_number} for ${order.service_name} is confirmed.`,
      type: 'booking',
      link: `/customer/orders/${order.id}`,
    });
    await notifyAdmins({
      title: 'New order',
      message: `${order.customer_name} booked ${order.service_name} (${order.order_number}).`,
      type: 'order',
      link: `/admin/orders/${order.id}`,
    });
    await mailSafe(() => sendBookingConfirmation(order));
    if (payment) await mailSafe(() => sendPaymentReceipt(order, payment));
    emitOrder(order, 'order:created');
    return presentOrder(order, 'CUSTOMER');
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function cancelOrder(id, user, reason) {
  const order = await findOrderById(id);
  if (!order) throw new ApiError(404, 'Order not found', 'ORDER_NOT_FOUND');
  if (user.role === 'CUSTOMER' && order.customer_user_id !== user.id) {
    throw new ApiError(403, 'You cannot cancel this order', 'FORBIDDEN');
  }
  if (!['pending', 'confirmed', 'assigned', 'accepted'].includes(order.order_status)) {
    throw new ApiError(400, 'This order can no longer be cancelled', 'CANCEL_NOT_ALLOWED');
  }
  if (user.role !== 'ADMIN') {
    const settings = await getSettingsMap();
    const hours = Number(settings.cancellation_hours || 4);
    const scheduled = parseSqlDate(`${String(order.scheduled_date).slice(0, 10)} ${order.scheduled_time}`);
    if ((scheduled.getTime() - Date.now()) / 36e5 < hours) {
      throw new ApiError(400, `Orders can only be cancelled ${hours} hours before the visit`, 'CANCEL_WINDOW_CLOSED');
    }
  }
  await pool.query(
    `UPDATE orders SET order_status = 'cancelled', cancellation_reason = ? WHERE id = ?`,
    [reason || 'Cancelled', id],
  );
  await pool.query(
    'INSERT INTO order_status_history (order_id, status, note, changed_by) VALUES (?, \'cancelled\', ?, ?)',
    [id, reason || 'Order cancelled', user.id],
  );
  const updated = await findOrderById(id);
  await notifyAdmins({
    title: 'Order cancelled',
    message: `${updated.order_number} was cancelled.`,
    type: 'order',
    link: `/admin/orders/${id}`,
  });
  if (updated.technician_user_id) {
    await notifyUser({
      userId: updated.technician_user_id,
      title: 'Job cancelled',
      message: `${updated.customer_name} cancelled ${updated.order_number}.`,
      type: 'order',
      link: `/technician/orders/${id}`,
    });
  }
  if (user.role !== 'CUSTOMER') {
    await notifyUser({
      userId: updated.customer_user_id,
      title: 'Booking cancelled',
      message: `${updated.order_number} has been cancelled.`,
      type: 'order',
      link: `/customer/orders/${id}`,
    });
  }
  emitOrder(updated, 'order:updated');
  return presentOrder(updated, user.role);
}

export async function rescheduleOrder(id, user, { scheduledDate, scheduledTime }) {
  const order = await findOrderById(id);
  if (!order) throw new ApiError(404, 'Order not found', 'ORDER_NOT_FOUND');
  if (user.role === 'CUSTOMER' && order.customer_user_id !== user.id) throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
  if (!['pending', 'confirmed', 'assigned', 'accepted'].includes(order.order_status)) {
    throw new ApiError(400, 'This order can no longer be rescheduled', 'RESCHEDULE_NOT_ALLOWED');
  }
  const settings = await getSettingsMap();
  const hours = Number(settings.reschedule_hours || 4);
  const current = parseSqlDate(`${String(order.scheduled_date).slice(0, 10)} ${order.scheduled_time}`);
  if (user.role !== 'ADMIN' && (current.getTime() - Date.now()) / 36e5 < hours) {
    throw new ApiError(400, `Rescheduling closes ${hours} hours before the visit`, 'RESCHEDULE_WINDOW_CLOSED');
  }
  const time = scheduledTime.length === 5 ? `${scheduledTime}:00` : scheduledTime;
  await pool.query('UPDATE orders SET scheduled_date = ?, scheduled_time = ? WHERE id = ?', [scheduledDate, time, id]);
  await pool.query(
    'INSERT INTO order_status_history (order_id, status, note, changed_by) VALUES (?, ?, ?, ?)',
    [id, order.order_status, `Rescheduled to ${scheduledDate} ${scheduledTime}`, user.id],
  );
  const updated = await findOrderById(id);
  emitOrder(updated, 'order:updated');
  return presentOrder(updated, user.role);
}

export async function candidateTechnicians(orderId, query = {}) {
  const order = await findOrderById(orderId);
  if (!order) throw new ApiError(404, 'Order not found', 'ORDER_NOT_FOUND');
  const settings = await getSettingsMap();
  const where = ["t.approval_status = 'approved'", "u.status = 'active'"];
  const params = [];
  if (query.available === '1') {
    where.push("t.availability = 'available' AND t.is_online = 1");
  }
  if (query.levelId) {
    where.push('t.level_id = ?');
    params.push(query.levelId);
  }
  if (query.minRating) {
    where.push('t.rating_avg >= ?');
    params.push(Number(query.minRating));
  }
  const [techs] = await pool.query(
    `SELECT t.id, u.name, u.phone, u.avatar, t.experience_years, t.rating_avg, t.rating_count,
            t.availability, t.is_online, t.daily_job_limit, t.base_latitude, t.base_longitude,
            el.name AS level_name,
            (SELECT latitude FROM technician_locations tl WHERE tl.technician_id = t.id ORDER BY tl.id DESC LIMIT 1) AS latitude,
            (SELECT longitude FROM technician_locations tl WHERE tl.technician_id = t.id ORDER BY tl.id DESC LIMIT 1) AS longitude,
            (SELECT created_at FROM technician_locations tl WHERE tl.technician_id = t.id ORDER BY tl.id DESC LIMIT 1) AS location_updated_at,
            EXISTS(SELECT 1 FROM technician_services ts WHERE ts.technician_id = t.id AND ts.service_id = ?) AS has_expertise
     FROM technicians t
     JOIN users u ON u.id = t.user_id
     LEFT JOIN technician_experience_levels el ON el.id = t.level_id
     WHERE ${where.join(' AND ')}`,
    [order.service_id, ...params],
  );
  const defaultLimit = Number(settings.max_jobs_per_day || 5);
  const items = [];
  for (const tech of techs) {
    const jobsToday = await jobsOnDate(tech.id, String(order.scheduled_date).slice(0, 10));
    const limit = tech.daily_job_limit || defaultLimit;
    const lat = tech.latitude ?? tech.base_latitude;
    const lng = tech.longitude ?? tech.base_longitude;
    const distance = haversineKm(order.latitude, order.longitude, lat, lng);
    const cost = await resolveTechnicianCost(tech.id, order.service_id);
    items.push({
      ...tech,
      jobs_today: jobsToday,
      daily_limit: limit,
      limit_reached: jobsToday >= limit,
      distance_km: distance,
      technician_cost: cost,
      available_for_job: tech.availability === 'available' && ! (jobsToday >= limit),
    });
  }
  let filtered = items;
  if (query.expertise === '1') filtered = filtered.filter((t) => t.has_expertise);
  if (query.withinLimit === '1') filtered = filtered.filter((t) => !t.limit_reached);
  if (query.maxDistance) filtered = filtered.filter((t) => t.distance_km === null || t.distance_km <= Number(query.maxDistance));
  filtered.sort((a, b) => {
    const d = (a.distance_km ?? 999) - (b.distance_km ?? 999);
    if (d !== 0) return d;
    if (b.has_expertise - a.has_expertise) return b.has_expertise - a.has_expertise;
    return a.jobs_today - b.jobs_today;
  });
  return { order: presentOrder(order, 'ADMIN'), technicians: filtered };
}

export async function assignTechnician(orderId, adminUser, { technicianId, override = false, note }) {
  const order = await findOrderById(orderId);
  if (!order) throw new ApiError(404, 'Order not found', 'ORDER_NOT_FOUND');
  if (['cancelled', 'refunded', 'service_completed', 'payment_completed', 'service_started'].includes(order.order_status)) {
    throw new ApiError(400, 'This order cannot be reassigned now', 'ASSIGN_NOT_ALLOWED');
  }
  const [techRows] = await pool.query(
    `SELECT t.*, u.name, u.phone, u.status AS user_status, u.id AS user_id
     FROM technicians t JOIN users u ON u.id = t.user_id WHERE t.id = ?`,
    [technicianId],
  );
  const tech = techRows[0];
  if (!tech || tech.approval_status !== 'approved' || tech.user_status !== 'active') {
    throw new ApiError(400, 'Technician is not approved', 'TECHNICIAN_UNAVAILABLE');
  }
  const settings = await getSettingsMap();
  const jobsToday = await jobsOnDate(tech.id, String(order.scheduled_date).slice(0, 10));
  const limit = tech.daily_job_limit || Number(settings.max_jobs_per_day || 5);
  const unavailable = tech.availability === 'offline' || tech.availability === 'on_leave' || tech.availability === 'busy';
  if (!override && jobsToday >= limit && order.technician_id !== tech.id) {
    throw new ApiError(409, 'Daily limit reached for this technician', 'DAILY_LIMIT_REACHED');
  }
  if (!override && unavailable) {
    throw new ApiError(409, 'Technician is not available. Override to assign anyway.', 'TECHNICIAN_UNAVAILABLE');
  }
  const technicianCost = await resolveTechnicianCost(tech.id, order.service_id);
  const adminMargin = marginFor(order, technicianCost, order.other_costs);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    if (order.technician_id && order.technician_id !== tech.id) {
      await conn.query(
        `UPDATE technician_assignments SET status = 'reassigned'
         WHERE order_id = ? AND technician_id = ? AND status IN ('assigned','accepted')`,
        [orderId, order.technician_id],
      );
    }
    await conn.query(
      `UPDATE orders SET technician_id = ?, technician_cost = ?, admin_margin = ?, order_status = 'assigned' WHERE id = ?`,
      [tech.id, technicianCost, adminMargin, orderId],
    );
    await conn.query(
      `INSERT INTO technician_assignments (order_id, technician_id, assigned_by, status, note)
       VALUES (?, ?, ?, 'assigned', ?)`,
      [orderId, tech.id, adminUser.id, note || null],
    );
    await addHistory(conn, orderId, 'assigned', `Assigned to ${tech.name}`, adminUser.id);
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
  const updated = await findOrderById(orderId);
  await notifyUser({
    userId: tech.user_id,
    title: 'New job assigned',
    message: `${updated.order_number} · ${updated.service_name} · ${updated.city}`,
    type: 'assignment',
    link: `/technician/orders/${orderId}`,
  });
  await notifyUser({
    userId: updated.customer_user_id,
    title: 'Technician assigned',
    message: `${tech.name} will handle ${updated.order_number}.`,
    type: 'assignment',
    link: `/customer/orders/${orderId}`,
  });
  if (order.technician_user_id && order.technician_user_id !== tech.user_id) {
    await notifyUser({
      userId: order.technician_user_id,
      title: 'Assignment changed',
      message: `${updated.order_number} was reassigned.`,
      type: 'assignment',
      link: `/technician/orders`,
    });
  }
  await mailSafe(() => sendTechnicianAssignedEmail(updated));
  emitOrder(updated, 'order:assigned');
  return presentOrder(updated, 'ADMIN');
}

async function recordEarning(order) {
  if (!order.technician_id) return;
  await pool.query(
    `INSERT INTO technician_earnings (technician_id, order_id, base_amount, incentive_amount, total_amount, status, earned_at)
     VALUES (?, ?, ?, 0, ?, 'earned', NOW())
     ON DUPLICATE KEY UPDATE base_amount = VALUES(base_amount), total_amount = VALUES(total_amount), status = 'earned'`,
    [order.technician_id, order.id, order.technician_cost, order.technician_cost],
  );
  await recalculateIncentives(order.technician_id);
}

export async function updateOrderStatus(id, user, status, { note, images = [] } = {}) {
  const tech = await technicianByUser(user.id);
  if (!tech || tech.approval_status !== 'approved') {
    throw new ApiError(403, 'Your technician account is not approved', 'TECHNICIAN_NOT_APPROVED');
  }
  const order = await findOrderById(id);
  if (!order || order.technician_id !== tech.id) throw new ApiError(404, 'Assigned order not found', 'ORDER_NOT_FOUND');
  const allowed = TECH_NEXT[order.order_status] || [];
  if (!allowed.includes(status)) {
    throw new ApiError(400, `Cannot move this job from ${order.order_status} to ${status}`, 'INVALID_STATUS');
  }
  if (status === 'on_the_way' && !tech.is_online) {
    throw new ApiError(400, 'Go online before starting travel', 'TECHNICIAN_OFFLINE');
  }

  if (status === 'rejected') {
    await pool.query(
      `UPDATE technician_assignments SET status = 'rejected' WHERE order_id = ? AND technician_id = ? AND status = 'assigned'`,
      [id, tech.id],
    );
    await pool.query(
      `UPDATE orders SET technician_id = NULL, order_status = 'confirmed', technician_cost = ?, admin_margin = ? WHERE id = ?`,
      [await resolveTechnicianCost(null, order.service_id), marginFor({ ...order, discount: order.discount }, await resolveTechnicianCost(null, order.service_id), order.other_costs), id],
    );
    await pool.query(
      'INSERT INTO order_status_history (order_id, status, note, changed_by) VALUES (?, \'rejected\', ?, ?)',
      [id, note || 'Technician rejected the assignment', user.id],
    );
    const updated = await findOrderById(id);
    await notifyAdmins({
      title: 'Assignment rejected',
      message: `${tech.name} rejected ${order.order_number}.`,
      type: 'order',
      link: `/admin/orders/${id}`,
    });
    emitOrder(updated, 'order:updated');
    return presentOrder(updated, 'TECHNICIAN');
  }

  let nextStatus = status;
  if (status === 'service_completed' && order.payment_status === 'paid') nextStatus = 'payment_completed';
  await pool.query('UPDATE orders SET order_status = ? WHERE id = ?', [nextStatus, id]);
  if (status === 'accepted') {
    await pool.query(
      `UPDATE technician_assignments SET status = 'accepted' WHERE order_id = ? AND technician_id = ? ORDER BY id DESC LIMIT 1`,
      [id, tech.id],
    );
  }
  await pool.query(
    'INSERT INTO order_status_history (order_id, status, note, changed_by) VALUES (?, ?, ?, ?)',
    [id, status, note || null, user.id],
  );
  if (nextStatus === 'payment_completed' && status !== 'payment_completed') {
    await pool.query(
      'INSERT INTO order_status_history (order_id, status, note, changed_by) VALUES (?, \'payment_completed\', \'Payment was already received\', ?)',
      [id, user.id],
    );
  }
  for (const image of images) {
    await pool.query('INSERT INTO order_images (order_id, image_path, uploaded_by) VALUES (?, ?, ?)', [id, image, user.id]);
  }
  const updated = await findOrderById(id);
  if (status === 'on_the_way') {
    await notifyUser({
      userId: updated.customer_user_id,
      title: 'Technician is on the way',
      message: `${updated.technician_name} is travelling for ${updated.order_number}.`,
      type: 'tracking',
      link: `/customer/track/${id}`,
    });
    await mailSafe(() => sendTechnicianOnTheWayEmail(updated));
  }
  if (status === 'service_started') {
    await notifyUser({
      userId: updated.customer_user_id,
      title: 'Service started',
      message: `${updated.service_name} has started.`,
      type: 'order',
      link: `/customer/orders/${id}`,
    });
    await mailSafe(() => sendServiceStartedEmail(updated));
  }
  if (status === 'service_completed' || nextStatus === 'payment_completed') {
    await recordEarning(updated);
    await notifyUser({
      userId: updated.customer_user_id,
      title: 'Service completed',
      message: `${updated.order_number} is complete. Please leave a review.`,
      type: 'order',
      link: `/customer/orders/${id}`,
    });
    await notifyAdmins({
      title: 'Service completed',
      message: `${updated.order_number} was completed by ${updated.technician_name}.`,
      type: 'order',
      link: `/admin/orders/${id}`,
    });
    await mailSafe(() => sendServiceCompletedEmail(updated));
  }
  emitOrder(updated, 'order:updated');
  return presentOrder(updated, 'TECHNICIAN');
}

export async function payOrder(orderId, user, { method }) {
  const order = await findOrderById(orderId);
  if (!order) throw new ApiError(404, 'Order not found', 'ORDER_NOT_FOUND');
  if (user.role === 'CUSTOMER' && order.customer_user_id !== user.id) throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
  if (user.role === 'TECHNICIAN' && order.technician_id !== (await technicianByUser(user.id))?.id) {
    throw new ApiError(403, 'Forbidden', 'FORBIDDEN');
  }
  if (order.payment_status === 'paid') throw new ApiError(400, 'This order is already paid', 'ALREADY_PAID');
  if (['cancelled', 'refunded'].includes(order.order_status)) {
    throw new ApiError(400, 'Cancelled orders cannot be paid', 'PAY_NOT_ALLOWED');
  }
  const payMethod = ['cash', 'upi', 'card', 'online', 'other'].includes(method) ? method : order.payment_method;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const payment = await insertPayment(conn, {
      orderId, customerId: order.customer_id, amount: order.total_amount, method: payMethod, status: 'paid',
    });
    const done = ['service_completed', 'payment_completed'].includes(order.order_status);
    const nextStatus = done ? 'payment_completed' : order.order_status;
    await conn.query(
      'UPDATE orders SET payment_status = \'paid\', payment_method = ?, order_status = ? WHERE id = ?',
      [payMethod, nextStatus, orderId],
    );
    if (done && order.order_status !== 'payment_completed') {
      await addHistory(conn, orderId, 'payment_completed', `Paid via ${payMethod}`, user.id);
    } else {
      await addHistory(conn, orderId, order.order_status, `Payment received via ${payMethod}`, user.id);
    }
    await conn.commit();
    const updated = await findOrderById(orderId);
    await notifyUser({
      userId: updated.customer_user_id,
      title: 'Payment received',
      message: `₹${Number(updated.total_amount).toLocaleString('en-IN')} received for ${updated.order_number}.`,
      type: 'payment',
      link: `/customer/payments`,
    });
    await notifyAdmins({
      title: 'Payment received',
      message: `${updated.order_number} was paid by ${payMethod}.`,
      type: 'payment',
      link: `/admin/payments`,
    });
    await mailSafe(() => sendPaymentReceipt(updated, payment));
    emitOrder(updated, 'order:updated');
    return { order: presentOrder(updated, user.role), payment };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function refundOrder(orderId, user, reason) {
  const order = await findOrderById(orderId);
  if (!order) throw new ApiError(404, 'Order not found', 'ORDER_NOT_FOUND');
  if (order.payment_status !== 'paid') throw new ApiError(400, 'Only paid orders can be refunded', 'REFUND_NOT_ALLOWED');
  await pool.query(
    `UPDATE orders SET payment_status = 'refunded', order_status = 'refunded', cancellation_reason = ? WHERE id = ?`,
    [reason || 'Refunded by admin', orderId],
  );
  await pool.query(
    `UPDATE payments SET status = 'refunded' WHERE order_id = ? AND status = 'paid'`,
    [orderId],
  );
  await pool.query(
    `UPDATE technician_earnings SET status = 'reversed' WHERE order_id = ?`,
    [orderId],
  );
  await pool.query(
    'INSERT INTO order_status_history (order_id, status, note, changed_by) VALUES (?, \'refunded\', ?, ?)',
    [orderId, reason || 'Refund issued', user.id],
  );
  if (order.technician_id) await recalculateIncentives(order.technician_id);
  const updated = await findOrderById(orderId);
  await notifyUser({
    userId: updated.customer_user_id,
    title: 'Refund issued',
    message: `${updated.order_number} has been refunded.`,
    type: 'payment',
    link: `/customer/orders/${orderId}`,
  });
  emitOrder(updated, 'order:updated');
  return presentOrder(updated, 'ADMIN');
}

export async function tracking(orderId, user) {
  const order = await findOrderById(orderId);
  if (!order) throw new ApiError(404, 'Order not found', 'ORDER_NOT_FOUND');
  assertViewer(order, user);
  const trackable = ['on_the_way', 'arrived'].includes(order.order_status);
  let technicianLocation = null;
  if (order.technician_id && (trackable || user.role === 'ADMIN')) {
    const [locs] = await pool.query(
      `SELECT latitude, longitude, accuracy, created_at FROM technician_locations
       WHERE technician_id = ? ORDER BY id DESC LIMIT 1`,
      [order.technician_id],
    );
    if (trackable || user.role === 'ADMIN') technicianLocation = locs[0] || null;
  }
  if (!trackable && user.role === 'CUSTOMER') technicianLocation = null;
  return {
    order: presentOrder(order, user.role),
    trackable,
    maps_url: mapsDirectionUrl(order.latitude, order.longitude),
    customer_location: {
      latitude: order.latitude,
      longitude: order.longitude,
      address: order.address_line,
    },
    technician_location: technicianLocation,
  };
}

export async function saveTechnicianLocation(user, { latitude, longitude, accuracy }) {
  const tech = await technicianByUser(user.id);
  if (!tech) throw new ApiError(404, 'Technician profile not found', 'TECHNICIAN_NOT_FOUND');
  if (!tech.is_online) throw new ApiError(400, 'Go online before sharing your location', 'TECHNICIAN_OFFLINE');
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new ApiError(422, 'A valid location is required', 'LOCATION_REQUIRED');
  }
  await pool.query(
    'INSERT INTO technician_locations (technician_id, latitude, longitude, accuracy) VALUES (?, ?, ?, ?)',
    [tech.id, lat, lng, accuracy || null],
  );
  const [jobs] = await pool.query(
    `SELECT id FROM orders WHERE technician_id = ? AND order_status IN ('on_the_way','arrived')`,
    [tech.id],
  );
  const payload = {
    technicianId: tech.id,
    name: tech.name,
    latitude: lat,
    longitude: lng,
    accuracy: accuracy || null,
    updatedAt: new Date().toISOString(),
  };
  jobs.forEach((job) => emitLocation({ ...payload, orderId: job.id }));
  if (!jobs.length) emitLocation(payload);
  return payload;
}

export async function addReview(orderId, user, { rating, comment }) {
  const customer = await customerByUser(user.id);
  const order = await findOrderById(orderId);
  if (!order || order.customer_id !== customer?.id) throw new ApiError(404, 'Order not found', 'ORDER_NOT_FOUND');
  if (!['service_completed', 'payment_completed'].includes(order.order_status)) {
    throw new ApiError(400, 'You can review a service after it is completed', 'REVIEW_NOT_ALLOWED');
  }
  if (!order.technician_id) throw new ApiError(400, 'No technician to review', 'REVIEW_NOT_ALLOWED');
  const score = Number(rating);
  if (score < 1 || score > 5) throw new ApiError(422, 'Rating must be between 1 and 5', 'VALIDATION_ERROR');
  try {
    await pool.query(
      `INSERT INTO reviews (order_id, customer_id, technician_id, rating, comment, status)
       VALUES (?, ?, ?, ?, ?, 'published')`,
      [orderId, customer.id, order.technician_id, score, comment || null],
    );
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') throw new ApiError(400, 'You already reviewed this order', 'REVIEW_EXISTS');
    throw error;
  }
  await refreshRating(order.technician_id);
  return { rating: score, comment: comment || '' };
}

export async function refreshRating(technicianId) {
  await pool.query(
    `UPDATE technicians t
     SET rating_avg = COALESCE((SELECT AVG(rating) FROM reviews WHERE technician_id = t.id AND status = 'published'), 0),
         rating_count = (SELECT COUNT(*) FROM reviews WHERE technician_id = t.id AND status = 'published')
     WHERE t.id = ?`,
    [technicianId],
  );
}

export async function customerDashboard(user) {
  const customer = await customerByUser(user.id);
  const [stats] = await pool.query(
    `SELECT
       COUNT(*) AS total_orders,
       SUM(order_status IN (${ACTIVE.map(() => '?').join(',')})) AS active_orders,
       SUM(order_status IN ('service_completed','payment_completed')) AS completed_orders,
       SUM(order_status IN ('cancelled','refunded')) AS cancelled_orders,
       COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total_amount ELSE 0 END), 0) AS total_spent
     FROM orders WHERE customer_id = ?`,
    [...ACTIVE, customer.id],
  );
  const [currentRows] = await pool.query(
    `${ORDER_SELECT} WHERE o.customer_id = ? AND o.order_status IN (${ACTIVE.map(() => '?').join(',')})
     ORDER BY o.scheduled_date ASC, o.scheduled_time ASC LIMIT 1`,
    [customer.id, ...ACTIVE],
  );
  const current = currentRows[0] ? presentOrder(currentRows[0], 'CUSTOMER') : null;
  return { stats: stats[0], current };
}

export async function technicianDashboard(user) {
  const tech = await technicianByUser(user.id);
  if (!tech) throw new ApiError(404, 'Technician profile not found', 'TECHNICIAN_NOT_FOUND');
  const today = todaySql();
  const [jobs] = await pool.query(
    `SELECT
       SUM(scheduled_date = ?) AS todays_jobs,
       SUM(order_status IN ('service_completed','payment_completed')) AS completed_jobs,
       SUM(order_status IN ('assigned','accepted','on_the_way','arrived','service_started')) AS pending_jobs
     FROM orders WHERE technician_id = ?`,
    [today, tech.id],
  );
  const { earningsSummary } = await import('../../services/incentiveService.js');
  const { startOfWeek, startOfMonth, startOfYear } = await import('../../utils/dates.js');
  const daily = await earningsSummary(tech.id, today, today, 'daily');
  const weekly = await earningsSummary(tech.id, todaySql(startOfWeek()), today, 'weekly');
  const monthly = await earningsSummary(tech.id, todaySql(startOfMonth()), today, 'monthly');
  const yearly = await earningsSummary(tech.id, todaySql(startOfYear()), today, 'daily');
  const [sales] = await pool.query(
    `SELECT
       COALESCE(SUM(CASE WHEN scheduled_date = ? AND payment_status = 'paid' THEN total_amount END), 0) AS today_sales,
       COALESCE(SUM(CASE WHEN scheduled_date >= ? AND payment_status = 'paid' THEN total_amount END), 0) AS week_sales,
       COALESCE(SUM(CASE WHEN scheduled_date >= ? AND payment_status = 'paid' THEN total_amount END), 0) AS month_sales,
       COALESCE(SUM(CASE WHEN scheduled_date >= ? AND payment_status = 'paid' THEN total_amount END), 0) AS year_sales
     FROM orders WHERE technician_id = ?`,
    [today, todaySql(startOfWeek()), todaySql(startOfMonth()), todaySql(startOfYear()), tech.id],
  );
  const [upcoming] = await pool.query(
    `${ORDER_SELECT} WHERE o.technician_id = ? AND o.order_status NOT IN ('cancelled','refunded','rejected','payment_completed')
     ORDER BY o.scheduled_date ASC, o.scheduled_time ASC LIMIT 5`,
    [tech.id],
  );
  return {
    technician: tech,
    jobs: jobs[0],
    earnings: { daily, weekly, monthly, yearly },
    sales: sales[0],
    upcoming: upcoming.map((row) => ({ ...presentOrder(row, 'TECHNICIAN'), maps_url: mapsDirectionUrl(row.latitude, row.longitude) })),
  };
}

export { customerByUser, technicianByUser, findOrderById };
