import { pool } from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';
import { customerByUser } from '../orders/order.model.js';

export async function listAddresses(userId) {
  const customer = await customerByUser(userId);
  const [rows] = await pool.query('SELECT * FROM customer_addresses WHERE customer_id = ? ORDER BY is_default DESC, id DESC', [customer.id]);
  return rows;
}

export async function saveAddress(userId, body, id = null) {
  const customer = await customerByUser(userId);
  if (body.isDefault) {
    await pool.query('UPDATE customer_addresses SET is_default = 0 WHERE customer_id = ?', [customer.id]);
  }
  const payload = [
    body.label || 'Home', body.houseNo || null, body.street || null, body.area || null,
    body.city, body.state, body.pincode, body.landmark || null,
    body.latitude || null, body.longitude || null, body.isDefault ? 1 : 0,
  ];
  if (id) {
    const [owned] = await pool.query('SELECT id FROM customer_addresses WHERE id = ? AND customer_id = ?', [id, customer.id]);
    if (!owned[0]) throw new ApiError(404, 'Address not found', 'ADDRESS_NOT_FOUND');
    await pool.query(
      `UPDATE customer_addresses SET label=?, house_no=?, street=?, area=?, city=?, state=?, pincode=?, landmark=?, latitude=?, longitude=?, is_default=? WHERE id=?`,
      [...payload, id],
    );
    return id;
  }
  const [result] = await pool.query(
    `INSERT INTO customer_addresses (customer_id, label, house_no, street, area, city, state, pincode, landmark, latitude, longitude, is_default)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [customer.id, ...payload],
  );
  return result.insertId;
}

export async function deleteAddress(userId, id) {
  const customer = await customerByUser(userId);
  await pool.query('DELETE FROM customer_addresses WHERE id = ? AND customer_id = ?', [id, customer.id]);
}

export async function listPayments(user, query = {}) {
  const where = ['1=1'];
  const params = [];
  if (user.role === 'CUSTOMER') {
    const customer = await customerByUser(user.id);
    where.push('p.customer_id = ?');
    params.push(customer.id);
  } else if (user.role === 'TECHNICIAN') {
    const [tech] = await pool.query('SELECT id FROM technicians WHERE user_id = ?', [user.id]);
    where.push('o.technician_id = ?');
    params.push(tech[0]?.id || 0);
  }
  if (query.status) { where.push('p.status = ?'); params.push(query.status); }
  if (query.method) { where.push('p.method = ?'); params.push(query.method); }
  const [rows] = await pool.query(
    `SELECT p.*, o.order_number, o.order_status, s.name AS service_name, u.name AS customer_name
     FROM payments p
     JOIN orders o ON o.id = p.order_id
     JOIN services s ON s.id = o.service_id
     JOIN customers cu ON cu.id = p.customer_id
     JOIN users u ON u.id = cu.user_id
     WHERE ${where.join(' AND ')}
     ORDER BY p.id DESC
     LIMIT 200`,
    params,
  );
  return rows;
}

export async function listNotifications(userId) {
  const [rows] = await pool.query(
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 100',
    [userId],
  );
  const [unread] = await pool.query('SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = 0', [userId]);
  return { items: rows, unread: Number(unread[0].count) };
}

export async function markNotifications(userId, id) {
  if (id) {
    await pool.query('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [id, userId]);
  } else {
    await pool.query('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [userId]);
  }
}

export async function myReviews(userId) {
  const customer = await customerByUser(userId);
  const [rows] = await pool.query(
    `SELECT r.*, o.order_number, s.name AS service_name, tu.name AS technician_name
     FROM reviews r
     JOIN orders o ON o.id = r.order_id
     JOIN services s ON s.id = o.service_id
     JOIN technicians t ON t.id = r.technician_id
     JOIN users tu ON tu.id = t.user_id
     WHERE r.customer_id = ?
     ORDER BY r.id DESC`,
    [customer.id],
  );
  return rows;
}

export async function adminCustomers(query) {
  const where = ['1=1'];
  const params = [];
  if (query.q) {
    const q = `%${String(query.q).replace(/[%_]/g, '')}%`;
    where.push('(u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)');
    params.push(q, q, q);
  }
  if (query.status) { where.push('u.status = ?'); params.push(query.status); }
  const [rows] = await pool.query(
    `SELECT cu.*, u.name, u.email, u.phone, u.avatar, u.status, u.created_at AS joined_at,
       (SELECT COUNT(*) FROM orders o WHERE o.customer_id = cu.id) AS orders,
       (SELECT COUNT(*) FROM orders o WHERE o.customer_id = cu.id AND o.order_status IN ('service_completed','payment_completed')) AS completed,
       (SELECT COUNT(*) FROM orders o WHERE o.customer_id = cu.id AND o.order_status IN ('cancelled','refunded')) AS cancelled,
       (SELECT COALESCE(SUM(total_amount),0) FROM orders o WHERE o.customer_id = cu.id AND o.payment_status = 'paid') AS spent
     FROM customers cu
     JOIN users u ON u.id = cu.user_id
     WHERE ${where.join(' AND ')}
     ORDER BY u.created_at DESC`,
    params,
  );
  return rows;
}

export async function adminCustomer(id) {
  const [rows] = await pool.query(
    `SELECT cu.*, u.name, u.email, u.phone, u.avatar, u.status
     FROM customers cu JOIN users u ON u.id = cu.user_id WHERE cu.id = ?`,
    [id],
  );
  if (!rows[0]) throw new ApiError(404, 'Customer not found', 'CUSTOMER_NOT_FOUND');
  const [addresses] = await pool.query('SELECT * FROM customer_addresses WHERE customer_id = ?', [id]);
  const [orders] = await pool.query(
    `SELECT o.id, o.order_number, o.order_status, o.payment_status, o.total_amount, o.scheduled_date, s.name AS service_name
     FROM orders o JOIN services s ON s.id = o.service_id WHERE o.customer_id = ? ORDER BY o.id DESC LIMIT 30`,
    [id],
  );
  return { ...rows[0], addresses, orders };
}

export async function setUserStatus(userId, status) {
  if (!['active', 'inactive', 'suspended'].includes(status)) {
    throw new ApiError(422, 'Unknown status', 'VALIDATION_ERROR');
  }
  await pool.query('UPDATE users SET status = ? WHERE id = ? AND role <> \'ADMIN\'', [status, userId]);
}
