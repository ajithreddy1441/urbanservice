import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { pool } from '../../config/db.js';
import { rangeFor, todaySql, startOfWeek, startOfMonth, startOfYear, addDays } from '../../utils/dates.js';
import { ORDER_SELECT } from '../orders/order.model.js';

function num(value) {
  return Number(value || 0);
}

export async function adminDashboard() {
  const today = todaySql();
  const week = todaySql(startOfWeek());
  const month = todaySql(startOfMonth());
  const year = todaySql(startOfYear());
  const [sales] = await pool.query(
    `SELECT
       COALESCE(SUM(CASE WHEN DATE(paid_at) = ? THEN amount END), 0) AS today_sales,
       COALESCE(SUM(CASE WHEN DATE(paid_at) >= ? THEN amount END), 0) AS week_sales,
       COALESCE(SUM(CASE WHEN DATE(paid_at) >= ? THEN amount END), 0) AS month_sales,
       COALESCE(SUM(CASE WHEN DATE(paid_at) >= ? THEN amount END), 0) AS year_sales
     FROM payments WHERE status = 'paid'`,
    [today, week, month, year],
  );
  const [orders] = await pool.query(
    `SELECT
       SUM(DATE(created_at) = ?) AS today_orders,
       SUM(order_status IN ('pending','confirmed')) AS pending_orders,
       SUM(order_status IN ('service_completed','payment_completed')) AS completed_orders,
       SUM(order_status IN ('cancelled','refunded')) AS cancelled_orders
     FROM orders`,
    [today],
  );
  const [people] = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM customers) AS total_customers,
       (SELECT COUNT(*) FROM technicians) AS total_technicians,
       (SELECT COUNT(*) FROM technicians WHERE approval_status = 'approved' AND is_online = 1) AS active_technicians`,
  );
  const dailyStart = todaySql(addDays(new Date(), -13));
  const [daily] = await pool.query(
    `SELECT DATE(paid_at) AS label, SUM(amount) AS total
     FROM payments WHERE status = 'paid' AND DATE(paid_at) >= ?
     GROUP BY DATE(paid_at) ORDER BY label`,
    [dailyStart],
  );
  const [weekly] = await pool.query(
    `SELECT YEARWEEK(paid_at, 1) AS label, SUM(amount) AS total
     FROM payments WHERE status = 'paid' AND paid_at >= DATE_SUB(CURDATE(), INTERVAL 8 WEEK)
     GROUP BY YEARWEEK(paid_at, 1) ORDER BY label`,
  );
  const [monthly] = await pool.query(
    `SELECT DATE_FORMAT(paid_at, '%Y-%m') AS label, SUM(amount) AS total
     FROM payments WHERE status = 'paid' AND paid_at >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
     GROUP BY DATE_FORMAT(paid_at, '%Y-%m') ORDER BY label`,
  );
  const [yearly] = await pool.query(
    `SELECT YEAR(paid_at) AS label, SUM(amount) AS total
     FROM payments WHERE status = 'paid'
     GROUP BY YEAR(paid_at) ORDER BY label`,
  );
  const [byStatus] = await pool.query(
    `SELECT order_status AS status, COUNT(*) AS count FROM orders GROUP BY order_status`,
  );
  const [recent] = await pool.query(`${ORDER_SELECT} ORDER BY o.created_at DESC LIMIT 6`);
  return {
    cards: { ...sales[0], ...orders[0], ...people[0] },
    daily, weekly, monthly, yearly, byStatus, recent,
  };
}

function createdRange(query) {
  const range = rangeFor(query.period || 'month', query.from, query.to);
  return range;
}

export async function salesReport(query) {
  const { from, to } = createdRange(query);
  const group = query.group === 'month' ? "DATE_FORMAT(paid_at, '%Y-%m')"
    : query.group === 'year' ? 'YEAR(paid_at)'
      : query.group === 'week' ? 'YEARWEEK(paid_at, 1)'
        : 'DATE(paid_at)';
  const [series] = await pool.query(
    `SELECT ${group} AS label, SUM(amount) AS total, COUNT(*) AS payments
     FROM payments WHERE status = 'paid' AND paid_at BETWEEN ? AND ?
     GROUP BY label ORDER BY label`,
    [from, `${String(to).slice(0, 10)} 23:59:59`],
  );
  const [totals] = await pool.query(
    `SELECT COALESCE(SUM(amount),0) AS total, COUNT(*) AS payments
     FROM payments WHERE status = 'paid' AND paid_at BETWEEN ? AND ?`,
    [from, `${String(to).slice(0, 10)} 23:59:59`],
  );
  return { from, to, series, totals: totals[0] };
}

export async function orderReport(query) {
  const { from, to } = createdRange(query);
  const [rows] = await pool.query(
    `SELECT order_status AS status, COUNT(*) AS count, COALESCE(SUM(total_amount),0) AS amount
     FROM orders WHERE created_at BETWEEN ? AND ?
     GROUP BY order_status`,
    [from, to],
  );
  const [unassigned] = await pool.query(
    `SELECT COUNT(*) AS count FROM orders WHERE technician_id IS NULL AND order_status IN ('pending','confirmed') AND created_at BETWEEN ? AND ?`,
    [from, to],
  );
  return { from, to, rows, unassigned: num(unassigned[0].count) };
}

export async function technicianReport(query) {
  const { from, to } = createdRange(query);
  const end = `${String(to).slice(0, 10)} 23:59:59`;
  const [rows] = await pool.query(
    `SELECT t.id, u.name, el.name AS level_name, t.rating_avg, t.rating_count,
       (SELECT COUNT(*) FROM orders o WHERE o.technician_id = t.id AND o.created_at BETWEEN ? AND ?) AS jobs,
       (SELECT COUNT(*) FROM orders o WHERE o.technician_id = t.id AND o.order_status IN ('service_completed','payment_completed') AND o.created_at BETWEEN ? AND ?) AS completed,
       (SELECT COALESCE(SUM(base_amount),0) FROM technician_earnings e WHERE e.technician_id = t.id AND e.status = 'earned' AND e.earned_at BETWEEN ? AND ?) AS earnings,
       (SELECT COALESCE(SUM(amount),0) FROM technician_incentives i WHERE i.technician_id = t.id AND i.period_start BETWEEN ? AND ?) AS incentives
     FROM technicians t
     JOIN users u ON u.id = t.user_id
     LEFT JOIN technician_experience_levels el ON el.id = t.level_id
     ORDER BY earnings DESC`,
    [from, end, from, end, from, end, String(from).slice(0, 10), String(to).slice(0, 10)],
  );
  return { from, to, rows };
}

export async function customerReport(query) {
  const { from, to } = createdRange(query);
  const end = `${String(to).slice(0, 10)} 23:59:59`;
  const [summary] = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM customers) AS total_customers,
       (SELECT COUNT(*) FROM customers WHERE created_at BETWEEN ? AND ?) AS new_customers,
       (SELECT COUNT(*) FROM (
          SELECT customer_id FROM orders GROUP BY customer_id HAVING COUNT(*) > 1
        ) repeats) AS repeat_customers,
       (SELECT COALESCE(SUM(total_amount),0) FROM orders WHERE payment_status = 'paid' AND created_at BETWEEN ? AND ?) AS total_spending`,
    [from, end, from, end],
  );
  const [rows] = await pool.query(
    `SELECT u.name, u.email, u.phone, COUNT(o.id) AS orders, COALESCE(SUM(CASE WHEN o.payment_status='paid' THEN o.total_amount END),0) AS spent
     FROM customers cu
     JOIN users u ON u.id = cu.user_id
     LEFT JOIN orders o ON o.customer_id = cu.id AND o.created_at BETWEEN ? AND ?
     GROUP BY cu.id
     ORDER BY spent DESC
     LIMIT 100`,
    [from, end],
  );
  return { from, to, summary: summary[0], rows };
}

export async function serviceReport(query) {
  const { from, to } = createdRange(query);
  const end = `${String(to).slice(0, 10)} 23:59:59`;
  const [rows] = await pool.query(
    `SELECT s.id, s.name, c.name AS category_name,
       COUNT(o.id) AS bookings,
       COALESCE(SUM(o.total_amount),0) AS revenue,
       COALESCE(SUM(o.technician_cost),0) AS technician_cost,
       COALESCE(SUM(o.admin_margin),0) AS margin
     FROM services s
     JOIN categories c ON c.id = s.category_id
     LEFT JOIN orders o ON o.service_id = s.id AND o.created_at BETWEEN ? AND ? AND o.order_status NOT IN ('cancelled','rejected')
     GROUP BY s.id
     ORDER BY bookings DESC, revenue DESC`,
    [from, end],
  );
  return { from, to, rows };
}

export async function paymentReport(query) {
  const { from, to } = createdRange(query);
  const end = `${String(to).slice(0, 10)} 23:59:59`;
  const [rows] = await pool.query(
    `SELECT p.*, o.order_number, u.name AS customer_name, o.payment_status AS order_payment_status
     FROM payments p
     JOIN orders o ON o.id = p.order_id
     JOIN customers cu ON cu.id = p.customer_id
     JOIN users u ON u.id = cu.user_id
     WHERE p.created_at BETWEEN ? AND ?
     ORDER BY p.id DESC`,
    [from, end],
  );
  const [byMethod] = await pool.query(
    `SELECT method, status, COUNT(*) AS count, COALESCE(SUM(amount),0) AS amount
     FROM payments WHERE created_at BETWEEN ? AND ? GROUP BY method, status`,
    [from, end],
  );
  return { from, to, rows, byMethod };
}

export async function financialReport(query) {
  const { from, to } = createdRange(query);
  const end = `${String(to).slice(0, 10)} 23:59:59`;
  const [rows] = await pool.query(
    `SELECT
       COALESCE(SUM(subtotal),0) AS gross_sales,
       COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total_amount END),0) AS collected,
       COALESCE(SUM(technician_cost),0) AS technician_costs,
       COALESCE(SUM(discount),0) AS discounts,
       COALESCE(SUM(other_costs),0) AS other_costs,
       COALESCE(SUM(CASE WHEN payment_status = 'refunded' THEN total_amount END),0) AS refunds,
       COALESCE(SUM(admin_margin),0) AS estimated_margin
     FROM orders
     WHERE order_status NOT IN ('cancelled','rejected') AND created_at BETWEEN ? AND ?`,
    [from, end],
  );
  const [incentives] = await pool.query(
    `SELECT COALESCE(SUM(amount),0) AS incentives FROM technician_incentives WHERE period_type = 'daily' AND period_start BETWEEN ? AND ?`,
    [String(from).slice(0, 10), String(to).slice(0, 10)],
  );
  const base = rows[0];
  const net = num(base.collected) - num(base.technician_costs) - num(incentives[0].incentives) - num(base.refunds);
  return {
    from,
    to,
    ...base,
    incentives: num(incentives[0].incentives),
    net_revenue: Math.round(net * 100) / 100,
  };
}

export async function incentiveReport() {
  const [rules] = await pool.query('SELECT * FROM incentive_rules ORDER BY period_type, min_services');
  const [rows] = await pool.query(
    `SELECT i.*, u.name AS technician_name, r.name AS rule_name
     FROM technician_incentives i
     JOIN technicians t ON t.id = i.technician_id
     JOIN users u ON u.id = t.user_id
     LEFT JOIN incentive_rules r ON r.id = i.rule_id
     ORDER BY i.period_start DESC LIMIT 200`,
  );
  return { rules, rows };
}

const REPORTS = {
  sales: salesReport,
  orders: orderReport,
  technicians: technicianReport,
  customers: customerReport,
  services: serviceReport,
  payments: paymentReport,
  profit: financialReport,
  incentives: incentiveReport,
};

export async function runReport(type, query) {
  const fn = REPORTS[type];
  if (!fn) {
    const error = new Error('Unknown report');
    error.status = 404;
    error.errorCode = 'NOT_FOUND';
    throw error;
  }
  return fn(query);
}

function rowsFrom(type, data) {
  if (type === 'sales') return data.series;
  if (type === 'orders') return data.rows;
  if (type === 'profit') return [data];
  if (type === 'incentives') return data.rows;
  return data.rows || data.series || [];
}

export async function logReport(userId, type, query) {
  await pool.query(
    'INSERT INTO reports (report_type, title, filters, generated_by) VALUES (?, ?, ?, ?)',
    [type, `${type} report`, JSON.stringify(query || {}), userId],
  );
}

function csvEscape(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export async function exportReport(type, query, format) {
  const data = await runReport(type, query);
  const rows = rowsFrom(type, data);
  const columns = rows[0] ? Object.keys(rows[0]).filter((key) => typeof rows[0][key] !== 'object') : ['info'];
  const flat = rows.length ? rows : [{ info: 'No data' }];
  if (format === 'xlsx') {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(type);
    sheet.addRow(columns);
    flat.forEach((row) => sheet.addRow(columns.map((key) => row[key] ?? '')));
    const buffer = await workbook.xlsx.writeBuffer();
    return { buffer: Buffer.from(buffer), contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', filename: `${type}-report.xlsx` };
  }
  if (format === 'pdf') {
    const buffer = await new Promise((resolve) => {
      const doc = new PDFDocument({ margin: 36, size: 'A4' });
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.fontSize(16).text(`Urban Services · ${type} report`);
      doc.moveDown(0.5).fontSize(9).text(`Generated ${new Date().toLocaleString('en-IN')}`);
      doc.moveDown();
      flat.forEach((row) => {
        doc.fontSize(9).text(columns.map((key) => `${key}: ${row[key] ?? ''}`).join('   '));
        doc.moveDown(0.3);
      });
      doc.end();
    });
    return { buffer, contentType: 'application/pdf', filename: `${type}-report.pdf` };
  }
  const lines = [columns.map(csvEscape).join(',')];
  flat.forEach((row) => lines.push(columns.map((key) => csvEscape(row[key])).join(',')));
  return { buffer: Buffer.from(lines.join('\n'), 'utf8'), contentType: 'text/csv', filename: `${type}-report.csv` };
}

export async function liveMap() {
  const [technicians] = await pool.query(
    `SELECT t.id, u.name, t.availability, t.is_online, t.approval_status,
       (SELECT latitude FROM technician_locations tl WHERE tl.technician_id = t.id ORDER BY tl.id DESC LIMIT 1) AS latitude,
       (SELECT longitude FROM technician_locations tl WHERE tl.technician_id = t.id ORDER BY tl.id DESC LIMIT 1) AS longitude,
       (SELECT created_at FROM technician_locations tl WHERE tl.technician_id = t.id ORDER BY tl.id DESC LIMIT 1) AS last_updated,
       (SELECT CONCAT(o.order_number, ' · ', s.name) FROM orders o JOIN services s ON s.id = o.service_id
         WHERE o.technician_id = t.id AND o.order_status IN ('assigned','accepted','on_the_way','arrived','service_started')
         ORDER BY o.scheduled_date LIMIT 1) AS current_job
     FROM technicians t
     JOIN users u ON u.id = t.user_id
     WHERE t.approval_status = 'approved'`,
  );
  const [jobs] = await pool.query(
    `SELECT o.id, o.order_number, o.latitude, o.longitude, o.order_status, o.address_line, u.name AS customer_name, tu.name AS technician_name
     FROM orders o
     JOIN customers cu ON cu.id = o.customer_id
     JOIN users u ON u.id = cu.user_id
     LEFT JOIN technicians t ON t.id = o.technician_id
     LEFT JOIN users tu ON tu.id = t.user_id
     WHERE o.order_status IN ('confirmed','assigned','accepted','on_the_way','arrived','service_started')
       AND o.latitude IS NOT NULL`,
  );
  return { technicians, jobs };
}
