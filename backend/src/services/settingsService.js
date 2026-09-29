import { pool } from '../config/db.js';

const cache = { at: 0, map: {} };

export function clearSettingsCache() {
  cache.at = 0;
  cache.map = {};
}

export async function getSettingsMap() {
  if (Date.now() - cache.at < 10000 && Object.keys(cache.map).length) return cache.map;
  const [rows] = await pool.query('SELECT setting_key, setting_value FROM settings');
  cache.map = Object.fromEntries(rows.map((row) => [row.setting_key, row.setting_value]));
  cache.at = Date.now();
  return cache.map;
}

export async function getSetting(key, fallback = null) {
  const map = await getSettingsMap();
  return map[key] ?? fallback;
}

const PUBLIC_KEYS = new Set([
  'business_name', 'business_email', 'business_phone', 'business_address', 'logo', 'tagline',
  'primary_color', 'secondary_color', 'cancellation_hours', 'reschedule_hours', 'min_booking_lead_hours',
  'slot_start', 'slot_end', 'slot_interval', 'max_jobs_per_day', 'currency_symbol', 'hero_subtitle',
  'maps_browser_key', 'faqs', 'auto_assign', 'about_text',
]);

export async function publicSettings() {
  const map = await getSettingsMap();
  const data = {};
  PUBLIC_KEYS.forEach((key) => {
    if (map[key] !== undefined) data[key] = map[key];
  });
  if (data.faqs) {
    try { data.faqs = JSON.parse(data.faqs); } catch { data.faqs = []; }
  }
  return data;
}
