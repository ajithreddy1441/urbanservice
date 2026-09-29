import { pool } from '../config/db.js';
import { todaySql, startOfWeek, startOfMonth, addDays } from '../utils/dates.js';

function windowFor(periodType, date = new Date()) {
  if (periodType === 'weekly') {
    const start = startOfWeek(date);
    const end = addDays(start, 6);
    return { start: todaySql(start), end: todaySql(end) };
  }
  if (periodType === 'monthly') {
    const start = startOfMonth(date);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    return { start: todaySql(start), end: todaySql(end) };
  }
  const day = todaySql(date);
  return { start: day, end: day };
}

export async function countCompletedServices(technicianId, start, end) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS cnt
     FROM technician_earnings
     WHERE technician_id = ? AND status = 'earned' AND DATE(earned_at) BETWEEN ? AND ?`,
    [technicianId, start, end],
  );
  return Number(rows[0]?.cnt || 0);
}

export async function bestRule(periodType, count, day) {
  const [rules] = await pool.query(
    `SELECT * FROM incentive_rules
     WHERE status = 'active' AND period_type = ? AND min_services <= ?
       AND (start_date IS NULL OR start_date <= ?)
       AND (end_date IS NULL OR end_date >= ?)
     ORDER BY min_services DESC
     LIMIT 1`,
    [periodType, count, day, day],
  );
  return rules[0] || null;
}

export async function recalculateIncentives(technicianId, date = new Date()) {
  const day = todaySql(date);
  const results = [];
  for (const periodType of ['daily', 'weekly', 'monthly']) {
    const window = windowFor(periodType, date);
    const count = await countCompletedServices(technicianId, window.start, window.end);
    const rule = await bestRule(periodType, count, day);
    const amount = rule ? Number(rule.amount) : 0;
    await pool.query(
      `INSERT INTO technician_incentives
        (technician_id, rule_id, period_type, period_start, period_end, services_count, amount, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'calculated')
       ON DUPLICATE KEY UPDATE
        rule_id = VALUES(rule_id),
        period_end = VALUES(period_end),
        services_count = VALUES(services_count),
        amount = VALUES(amount)`,
      [technicianId, rule?.id || null, periodType, window.start, window.end, count, amount],
    );
    results.push({ periodType, ...window, count, amount, ruleName: rule?.name || null });
  }
  return results;
}

export async function earningsSummary(technicianId, start, end, periodType = 'daily') {
  const [rows] = await pool.query(
    `SELECT COALESCE(SUM(base_amount), 0) AS earnings, COUNT(*) AS jobs
     FROM technician_earnings
     WHERE technician_id = ? AND status = 'earned' AND DATE(earned_at) BETWEEN ? AND ?`,
    [technicianId, start, end],
  );
  const [inc] = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) AS incentives
     FROM technician_incentives
     WHERE technician_id = ? AND period_type = ? AND period_start >= ? AND period_start <= ?`,
    [technicianId, periodType, start, end],
  );
  return {
    jobs: Number(rows[0].jobs || 0),
    earnings: Number(rows[0].earnings || 0),
    incentives: Number(inc[0].incentives || 0),
    total: Number(rows[0].earnings || 0) + Number(inc[0].incentives || 0),
  };
}
