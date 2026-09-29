import { pool } from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';
import { todaySql, startOfWeek, startOfMonth, startOfYear, addDays } from '../../utils/dates.js';
import { mapsDirectionUrl } from '../../utils/geo.js';
import { earningsSummary } from '../../services/incentiveService.js';
import { technicianByUser } from '../orders/order.model.js';
import { notifyUser } from '../../services/notificationService.js';

export async function setAvailability(user, { availability, isOnline }) {
  const tech = await technicianByUser(user.id);
  if (!tech) throw new ApiError(404, 'Technician profile not found', 'TECHNICIAN_NOT_FOUND');
  if (tech.approval_status !== 'approved') {
    throw new ApiError(403, 'Your account is waiting for admin approval', 'TECHNICIAN_NOT_APPROVED');
  }
  const nextAvailability = availability || (isOnline ? 'available' : 'offline');
  const online = isOnline === undefined ? (nextAvailability === 'available' ? 1 : 0) : (isOnline ? 1 : 0);
  if (!['available', 'busy', 'on_leave', 'offline'].includes(nextAvailability)) {
    throw new ApiError(422, 'Unknown availability status', 'VALIDATION_ERROR');
  }
  await pool.query(
    'UPDATE technicians SET availability = ?, is_online = ? WHERE id = ?',
    [online ? (nextAvailability === 'offline' ? 'available' : nextAvailability) : (nextAvailability === 'available' ? 'offline' : nextAvailability), online, tech.id],
  );
  return technicianByUser(user.id);
}

export async function listEarnings(user) {
  const tech = await technicianByUser(user.id);
  const [rows] = await pool.query(
    `SELECT e.*, o.order_number, s.name AS service_name, o.scheduled_date
     FROM technician_earnings e
     JOIN orders o ON o.id = e.order_id
     JOIN services s ON s.id = o.service_id
     WHERE e.technician_id = ?
     ORDER BY e.earned_at DESC`,
    [tech.id],
  );
  return rows;
}

export async function listIncentives(user) {
  const tech = await technicianByUser(user.id);
  const [rows] = await pool.query(
    `SELECT i.*, r.name AS rule_name, r.min_services
     FROM technician_incentives i
     LEFT JOIN incentive_rules r ON r.id = i.rule_id
     WHERE i.technician_id = ?
     ORDER BY i.period_start DESC, i.period_type ASC`,
    [tech.id],
  );
  const [rules] = await pool.query("SELECT * FROM incentive_rules WHERE status = 'active' ORDER BY period_type, min_services");
  return { incentives: rows, rules };
}

export async function salesReport(user, period = 'daily') {
  const tech = await technicianByUser(user.id);
  const today = todaySql();
  let start = today;
  let end = today;
  let group = 'DATE(e.earned_at)';
  if (period === 'weekly') {
    start = todaySql(addDays(startOfWeek(), -7 * 7));
    group = 'YEARWEEK(e.earned_at, 1)';
  } else if (period === 'monthly') {
    start = todaySql(new Date(new Date().getFullYear(), new Date().getMonth() - 11, 1));
    group = "DATE_FORMAT(e.earned_at, '%Y-%m')";
  } else if (period === 'yearly') {
    start = todaySql(new Date(new Date().getFullYear() - 4, 0, 1));
    group = 'YEAR(e.earned_at)';
  } else {
    start = todaySql(addDays(new Date(), -13));
    group = 'DATE(e.earned_at)';
  }
  const summaryStart = period === 'weekly' ? todaySql(startOfWeek())
    : period === 'monthly' ? todaySql(startOfMonth())
      : period === 'yearly' ? todaySql(startOfYear())
        : today;
  const summary = await earningsSummary(tech.id, summaryStart, end, period === 'yearly' ? 'daily' : (period === 'daily' ? 'daily' : period));
  const [jobs] = await pool.query(
    `SELECT
       COUNT(*) AS jobs,
       SUM(order_status IN ('service_completed','payment_completed')) AS completed,
       SUM(payment_status IN ('unpaid','pending')) AS pending_payments,
       COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total_amount END), 0) AS sales
     FROM orders
     WHERE technician_id = ? AND scheduled_date BETWEEN ? AND ?`,
    [tech.id, summaryStart, end],
  );
  const [trend] = await pool.query(
    `SELECT ${group} AS label, COUNT(*) AS jobs, COALESCE(SUM(base_amount), 0) AS earnings
     FROM technician_earnings e
     WHERE e.technician_id = ? AND e.status = 'earned' AND DATE(e.earned_at) BETWEEN ? AND ?
     GROUP BY label
     ORDER BY label`,
    [tech.id, start, end],
  );
  const [salesTrend] = await pool.query(
    `SELECT ${group.replaceAll('e.earned_at', 'o.scheduled_date')} AS label, COALESCE(SUM(total_amount), 0) AS sales
     FROM orders o
     WHERE o.technician_id = ? AND o.payment_status = 'paid' AND o.scheduled_date BETWEEN ? AND ?
     GROUP BY label ORDER BY label`,
    [tech.id, start, end],
  );
  return {
    period,
    summary: {
      jobs: Number(jobs[0].jobs || 0),
      completed: Number(jobs[0].completed || 0),
      sales: Number(jobs[0].sales || 0),
      earnings: summary.earnings,
      incentive: summary.incentives,
      pendingPayments: Number(jobs[0].pending_payments || 0),
      totalEarnings: summary.total,
    },
    trend,
    salesTrend,
  };
}

export async function myCustomers(user) {
  const tech = await technicianByUser(user.id);
  const [rows] = await pool.query(
    `SELECT u.name, u.phone, o.city, o.address_line, o.latitude, o.longitude, o.order_number, o.order_status, o.scheduled_date, s.name AS service_name
     FROM orders o
     JOIN customers cu ON cu.id = o.customer_id
     JOIN users u ON u.id = cu.user_id
     JOIN services s ON s.id = o.service_id
     WHERE o.technician_id = ?
     ORDER BY o.scheduled_date DESC
     LIMIT 100`,
    [tech.id],
  );
  return rows.map((row) => ({ ...row, maps_url: mapsDirectionUrl(row.latitude, row.longitude) }));
}

export async function adminListTechnicians(query) {
  const where = ['1=1'];
  const params = [];
  if (query.approval) { where.push('t.approval_status = ?'); params.push(query.approval); }
  if (query.q) {
    const q = `%${String(query.q).replace(/[%_]/g, '')}%`;
    where.push('(u.name LIKE ? OR u.phone LIKE ? OR u.email LIKE ?)');
    params.push(q, q, q);
  }
  const [rows] = await pool.query(
    `SELECT t.*, u.name, u.email, u.phone, u.avatar, u.status AS user_status, el.name AS level_name,
       (SELECT COUNT(*) FROM orders o WHERE o.technician_id = t.id AND o.scheduled_date = CURDATE() AND o.order_status NOT IN ('cancelled','rejected','refunded')) AS jobs_today,
       (SELECT COALESCE(SUM(base_amount),0) FROM technician_earnings e WHERE e.technician_id = t.id AND e.status = 'earned' AND DATE(e.earned_at) = CURDATE()) AS earnings_today,
       (SELECT GROUP_CONCAT(s.name SEPARATOR ', ') FROM technician_services ts JOIN services s ON s.id = ts.service_id WHERE ts.technician_id = t.id) AS service_names
     FROM technicians t
     JOIN users u ON u.id = t.user_id
     LEFT JOIN technician_experience_levels el ON el.id = t.level_id
     WHERE ${where.join(' AND ')}
     ORDER BY t.created_at DESC`,
    params,
  );
  return rows;
}

export async function adminTechnician(id) {
  const [rows] = await pool.query(
    `SELECT t.*, u.name, u.email, u.phone, u.avatar, u.status AS user_status, el.name AS level_name
     FROM technicians t
     JOIN users u ON u.id = t.user_id
     LEFT JOIN technician_experience_levels el ON el.id = t.level_id
     WHERE t.id = ?`,
    [id],
  );
  if (!rows[0]) throw new ApiError(404, 'Technician not found', 'TECHNICIAN_NOT_FOUND');
  const [services] = await pool.query(
    `SELECT s.id, s.name FROM technician_services ts JOIN services s ON s.id = ts.service_id WHERE ts.technician_id = ?`,
    [id],
  );
  const [docs] = await pool.query('SELECT * FROM technician_documents WHERE technician_id = ?', [id]);
  const [costs] = await pool.query(
    `SELECT tc.*, s.name AS service_name, el.name AS level_name
     FROM technician_costs tc
     JOIN services s ON s.id = tc.service_id
     LEFT JOIN technician_experience_levels el ON el.id = tc.level_id
     WHERE tc.technician_id = ? OR (tc.technician_id IS NULL AND tc.level_id = ?)
     ORDER BY tc.effective_date DESC`,
    [id, rows[0].level_id],
  );
  return { ...rows[0], services, documents: docs, costs };
}

export async function setApproval(id, status, actor) {
  if (!['pending', 'approved', 'rejected', 'suspended'].includes(status)) {
    throw new ApiError(422, 'Unknown approval status', 'VALIDATION_ERROR');
  }
  const tech = await adminTechnician(id);
  await pool.query('UPDATE technicians SET approval_status = ? WHERE id = ?', [status, id]);
  if (status === 'suspended' || status === 'rejected') {
    await pool.query("UPDATE users SET status = 'suspended' WHERE id = ?", [tech.user_id]);
  } else if (status === 'approved') {
    await pool.query("UPDATE users SET status = 'active' WHERE id = ?", [tech.user_id]);
  }
  await notifyUser({
    userId: tech.user_id,
    title: 'Account update',
    message: `Your technician account is now ${status}.`,
    type: 'account',
    link: '/technician',
  });
  return adminTechnician(id);
}

export async function adminUpdateTechnician(id, body) {
  const tech = await adminTechnician(id);
  await pool.query(
    `UPDATE users SET name = ?, phone = ?, email = ? WHERE id = ?`,
    [body.name || tech.name, body.phone || tech.phone, (body.email || tech.email).toLowerCase(), tech.user_id],
  );
  await pool.query(
    `UPDATE technicians SET experience_years = ?, level_id = ?, daily_job_limit = ?, city = ?, state = ?, address = ?, bio = ?, upi_id = ?, bank_name = ?, bank_account = ?, bank_ifsc = ?
     WHERE id = ?`,
    [
      body.experienceYears ?? tech.experience_years,
      body.levelId ?? tech.level_id,
      body.dailyJobLimit === '' ? null : (body.dailyJobLimit ?? tech.daily_job_limit),
      body.city ?? tech.city,
      body.state ?? tech.state,
      body.address ?? tech.address,
      body.bio ?? tech.bio,
      body.upiId ?? tech.upi_id,
      body.bankName ?? tech.bank_name,
      body.bankAccount ?? tech.bank_account,
      body.bankIfsc ?? tech.bank_ifsc,
      id,
    ],
  );
  if (Array.isArray(body.serviceIds)) {
    await pool.query('DELETE FROM technician_services WHERE technician_id = ?', [id]);
    for (const serviceId of body.serviceIds) {
      await pool.query('INSERT INTO technician_services (technician_id, service_id) VALUES (?, ?)', [id, serviceId]);
    }
  }
  return adminTechnician(id);
}

export async function saveCost(body, id = null) {
  const payload = [
    body.technicianId || null,
    body.serviceId,
    body.levelId || null,
    body.cost,
    body.effectiveDate,
    body.status || 'active',
  ];
  if (id) {
    await pool.query(
      `UPDATE technician_costs SET technician_id=?, service_id=?, level_id=?, cost=?, effective_date=?, status=? WHERE id=?`,
      [...payload, id],
    );
    return id;
  }
  const [result] = await pool.query(
    `INSERT INTO technician_costs (technician_id, service_id, level_id, cost, effective_date, status) VALUES (?, ?, ?, ?, ?, ?)`,
    payload,
  );
  return result.insertId;
}

export async function listCosts() {
  const [rows] = await pool.query(
    `SELECT tc.*, u.name AS technician_name, s.name AS service_name, el.name AS level_name
     FROM technician_costs tc
     LEFT JOIN technicians t ON t.id = tc.technician_id
     LEFT JOIN users u ON u.id = t.user_id
     JOIN services s ON s.id = tc.service_id
     LEFT JOIN technician_experience_levels el ON el.id = tc.level_id
     ORDER BY tc.effective_date DESC, tc.id DESC`,
  );
  return rows;
}

export async function deleteCost(id) {
  await pool.query('DELETE FROM technician_costs WHERE id = ?', [id]);
}

export async function listLevels() {
  const [rows] = await pool.query('SELECT * FROM technician_experience_levels ORDER BY sort_order, id');
  return rows;
}

export async function saveLevel(body, id = null) {
  if (id) {
    await pool.query(
      'UPDATE technician_experience_levels SET name=?, description=?, sort_order=?, status=? WHERE id=?',
      [body.name, body.description || null, body.sortOrder || 0, body.status || 'active', id],
    );
    return id;
  }
  const [result] = await pool.query(
    'INSERT INTO technician_experience_levels (name, description, sort_order, status) VALUES (?, ?, ?, ?)',
    [body.name, body.description || null, body.sortOrder || 0, body.status || 'active'],
  );
  return result.insertId;
}

export async function deleteLevel(id) {
  const [used] = await pool.query('SELECT id FROM technicians WHERE level_id = ? LIMIT 1', [id]);
  if (used[0]) throw new ApiError(400, 'This level is assigned to technicians', 'LEVEL_IN_USE');
  await pool.query('DELETE FROM technician_experience_levels WHERE id = ?', [id]);
}
