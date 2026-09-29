import { pool } from '../../config/db.js';

export const ORDER_FROM = `
  FROM orders o
  JOIN customers cu ON cu.id = o.customer_id
  JOIN users u ON u.id = cu.user_id
  JOIN services s ON s.id = o.service_id
  JOIN categories c ON c.id = s.category_id
  LEFT JOIN technicians t ON t.id = o.technician_id
  LEFT JOIN users tu ON tu.id = t.user_id
  LEFT JOIN technician_experience_levels el ON el.id = t.level_id
`;

export const ORDER_SELECT = `
  SELECT o.*,
    cu.user_id AS customer_user_id,
    u.name AS customer_name, u.phone AS customer_phone, u.email AS customer_email, u.avatar AS customer_avatar,
    s.name AS service_name, s.slug AS service_slug, s.duration_minutes, s.image AS service_image,
    c.name AS category_name, c.id AS category_id,
    t.user_id AS technician_user_id, t.rating_avg, t.rating_count, t.availability AS technician_availability,
    t.is_online AS technician_online, t.experience_years, t.approval_status AS technician_approval,
    tu.name AS technician_name, tu.phone AS technician_phone, tu.avatar AS technician_avatar, tu.email AS technician_email,
    el.name AS level_name
  ${ORDER_FROM}
`;

export async function findOrderById(id) {
  const [rows] = await pool.query(`${ORDER_SELECT} WHERE o.id = ?`, [id]);
  return rows[0] || null;
}

export async function findOrderByNumber(orderNumber) {
  const [rows] = await pool.query(`${ORDER_SELECT} WHERE o.order_number = ?`, [orderNumber]);
  return rows[0] || null;
}

export function presentOrder(order, role) {
  if (!order) return order;
  const copy = { ...order };
  if (role !== 'ADMIN') delete copy.admin_margin;
  return copy;
}

export async function customerByUser(userId) {
  const [rows] = await pool.query('SELECT * FROM customers WHERE user_id = ?', [userId]);
  return rows[0] || null;
}

export async function technicianByUser(userId) {
  const [rows] = await pool.query(
    `SELECT t.*, u.name, u.email, u.phone, u.avatar, u.status AS user_status, el.name AS level_name
     FROM technicians t
     JOIN users u ON u.id = t.user_id
     LEFT JOIN technician_experience_levels el ON el.id = t.level_id
     WHERE t.user_id = ?`,
    [userId],
  );
  return rows[0] || null;
}
