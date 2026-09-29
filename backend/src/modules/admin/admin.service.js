import { pool } from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';
import { clearSettingsCache } from '../../services/settingsService.js';
import { notifyUser } from '../../services/notificationService.js';
import { refreshRating } from '../orders/order.service.js';

const SECRET_KEYS = new Set(['smtp_password', 'payment_secret']);

export async function getAllSettings() {
  const [rows] = await pool.query('SELECT setting_key, setting_value, group_name FROM settings ORDER BY group_name, setting_key');
  return rows.map((row) => (
    SECRET_KEYS.has(row.setting_key)
      ? { ...row, setting_value: row.setting_value ? '••••••••' : '' }
      : row
  ));
}

export async function updateSettings(entries = []) {
  for (const entry of entries) {
    if (!entry.key) continue;
    if (SECRET_KEYS.has(entry.key) && (!entry.value || String(entry.value).includes('•'))) continue;
    await pool.query(
      `INSERT INTO settings (setting_key, setting_value, group_name) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), group_name = VALUES(group_name)`,
      [entry.key, entry.value ?? '', entry.group || 'general'],
    );
  }
  clearSettingsCache();
  return getAllSettings();
}

export async function listIncentiveRules() {
  const [rows] = await pool.query('SELECT * FROM incentive_rules ORDER BY period_type, min_services');
  return rows;
}

export async function saveIncentive(body, id = null) {
  const payload = [body.name, body.periodType || 'daily', body.minServices, body.amount, body.startDate || null, body.endDate || null, body.status || 'active'];
  if (id) {
    await pool.query(
      `UPDATE incentive_rules SET name=?, period_type=?, min_services=?, amount=?, start_date=?, end_date=?, status=? WHERE id=?`,
      [...payload, id],
    );
    return id;
  }
  const [result] = await pool.query(
    `INSERT INTO incentive_rules (name, period_type, min_services, amount, start_date, end_date, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    payload,
  );
  return result.insertId;
}

export async function deleteIncentive(id) {
  await pool.query('DELETE FROM incentive_rules WHERE id = ?', [id]);
}

export async function listReviews(query) {
  const where = ['1=1'];
  const params = [];
  if (query.status) { where.push('r.status = ?'); params.push(query.status); }
  const [rows] = await pool.query(
    `SELECT r.*, u.name AS customer_name, tu.name AS technician_name, o.order_number, s.name AS service_name
     FROM reviews r
     JOIN customers cu ON cu.id = r.customer_id
     JOIN users u ON u.id = cu.user_id
     JOIN technicians t ON t.id = r.technician_id
     JOIN users tu ON tu.id = t.user_id
     JOIN orders o ON o.id = r.order_id
     JOIN services s ON s.id = o.service_id
     WHERE ${where.join(' AND ')}
     ORDER BY r.id DESC`,
    params,
  );
  return rows;
}

export async function moderateReview(id, status) {
  if (!['published', 'hidden'].includes(status)) throw new ApiError(422, 'Unknown review status', 'VALIDATION_ERROR');
  const [rows] = await pool.query('SELECT technician_id FROM reviews WHERE id = ?', [id]);
  if (!rows[0]) throw new ApiError(404, 'Review not found', 'REVIEW_NOT_FOUND');
  await pool.query('UPDATE reviews SET status = ? WHERE id = ?', [status, id]);
  await refreshRating(rows[0].technician_id);
}

export async function listLocations() {
  const [rows] = await pool.query('SELECT * FROM locations ORDER BY city, name');
  return rows;
}

export async function saveLocation(body, id = null) {
  const payload = [body.name, body.city, body.state, body.pincode || null, body.latitude || null, body.longitude || null, body.isServiceable === false ? 0 : 1];
  if (id) {
    await pool.query(
      `UPDATE locations SET name=?, city=?, state=?, pincode=?, latitude=?, longitude=?, is_serviceable=? WHERE id=?`,
      [...payload, id],
    );
    return id;
  }
  const [result] = await pool.query(
    `INSERT INTO locations (name, city, state, pincode, latitude, longitude, is_serviceable) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    payload,
  );
  return result.insertId;
}

export async function deleteLocation(id) {
  await pool.query('DELETE FROM locations WHERE id = ?', [id]);
}

export async function broadcast(body) {
  const audience = body.audience || 'all';
  const where = audience === 'customers' ? "role = 'CUSTOMER'" : audience === 'technicians' ? "role = 'TECHNICIAN'" : "role <> 'ADMIN'";
  const [users] = await pool.query(`SELECT id FROM users WHERE status = 'active' AND ${where}`);
  for (const user of users) {
    await notifyUser({
      userId: user.id,
      title: body.title,
      message: body.message,
      type: 'announcement',
      link: body.link || null,
    });
  }
  return { sent: users.length };
}

export async function adminUpdateOrder(id, body) {
  const [rows] = await pool.query('SELECT * FROM orders WHERE id = ?', [id]);
  const order = rows[0];
  if (!order) throw new ApiError(404, 'Order not found', 'ORDER_NOT_FOUND');
  const other = body.otherCosts ?? order.other_costs;
  const discount = body.discount ?? order.discount;
  const tax = Number(order.tax);
  const subtotal = Number(order.subtotal);
  const total = Math.round((subtotal - Number(discount) + tax) * 100) / 100;
  const margin = Math.round((total - Number(order.technician_cost) - Number(discount) - Number(other)) * 100) / 100;
  const time = body.scheduledTime
    ? (body.scheduledTime.length === 5 ? `${body.scheduledTime}:00` : body.scheduledTime)
    : order.scheduled_time;
  await pool.query(
    `UPDATE orders SET notes = ?, scheduled_date = ?, scheduled_time = ?, other_costs = ?, discount = ?, total_amount = ?, admin_margin = ? WHERE id = ?`,
    [body.notes ?? order.notes, body.scheduledDate || order.scheduled_date, time, other, discount, total, margin, id],
  );
  const { findOrderById, presentOrder } = await import('../orders/order.model.js');
  return presentOrder(await findOrderById(id), 'ADMIN');
}
