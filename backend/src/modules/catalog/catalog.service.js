import { pool } from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';
import { priceBreakdown, slugify } from '../../utils/money.js';

async function uniqueSlug(table, base, ignoreId = null) {
  let slug = slugify(base) || 'item';
  let n = 1;
  while (true) {
    const [rows] = await pool.query(
      `SELECT id FROM ${table} WHERE slug = ? ${ignoreId ? 'AND id <> ?' : ''} LIMIT 1`,
      ignoreId ? [slug, ignoreId] : [slug],
    );
    if (!rows[0]) return slug;
    n += 1;
    slug = `${slugify(base)}-${n}`;
  }
}

export function withFinalPrice(body, current = {}) {
  const prices = priceBreakdown({
    basePrice: body.basePrice ?? current.base_price ?? 0,
    discountAmount: body.discountAmount ?? current.discount_amount ?? 0,
    discountPercent: body.discountPercent ?? current.discount_percent ?? 0,
    taxPercent: body.taxPercent ?? current.tax_percent ?? 0,
    technicianCost: body.technicianCost ?? current.technician_cost ?? 0,
  });
  return prices;
}

export async function listCategories({ includeInactive = false } = {}) {
  const where = includeInactive ? '1=1' : "c.status = 'active'";
  const [rows] = await pool.query(
    `SELECT c.*, COUNT(s.id) AS service_count
     FROM categories c
     LEFT JOIN services s ON s.category_id = c.id AND s.status = 'active'
     WHERE ${where}
     GROUP BY c.id
     ORDER BY c.sort_order ASC, c.name ASC`,
  );
  return rows;
}

export async function saveCategory(body, id = null) {
  const slug = await uniqueSlug('categories', body.slug || body.name, id);
  const payload = [body.name, slug, body.description || null, body.icon || null, body.image || null, body.sortOrder || 0, body.status || 'active'];
  if (id) {
    await pool.query(
      `UPDATE categories SET name=?, slug=?, description=?, icon=?, image=?, sort_order=?, status=? WHERE id=?`,
      [...payload, id],
    );
    return id;
  }
  const [result] = await pool.query(
    `INSERT INTO categories (name, slug, description, icon, image, sort_order, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    payload,
  );
  return result.insertId;
}

export async function deleteCategory(id) {
  const [used] = await pool.query('SELECT id FROM services WHERE category_id = ? LIMIT 1', [id]);
  if (used[0]) throw new ApiError(400, 'Remove or move services before deleting this category', 'CATEGORY_IN_USE');
  await pool.query('DELETE FROM categories WHERE id = ?', [id]);
}

export async function listServices(query, { admin = false } = {}) {
  const where = ['1=1'];
  const params = [];
  if (!admin) {
    where.push("s.status = 'active'", 's.is_available = 1', "c.status = 'active'");
  }
  if (query.category) {
    where.push('(c.slug = ? OR c.id = ?)');
    params.push(query.category, query.category);
  }
  if (query.featured === '1') where.push('s.featured = 1');
  if (query.q) {
    const q = `%${String(query.q).replace(/[%_]/g, '').trim()}%`;
    where.push('(s.name LIKE ? OR s.description LIKE ? OR c.name LIKE ?)');
    params.push(q, q, q);
  }
  const [rows] = await pool.query(
    `SELECT s.*, c.name AS category_name, c.slug AS category_slug,
       (SELECT ROUND(AVG(r.rating), 1) FROM reviews r JOIN orders o ON o.id = r.order_id WHERE o.service_id = s.id AND r.status = 'published') AS rating
     FROM services s
     JOIN categories c ON c.id = s.category_id
     WHERE ${where.join(' AND ')}
     ORDER BY s.sort_order ASC, s.featured DESC, s.name ASC`,
    params,
  );
  return rows;
}

export async function getService(idOrSlug) {
  const [rows] = await pool.query(
    `SELECT s.*, c.name AS category_name, c.slug AS category_slug
     FROM services s JOIN categories c ON c.id = s.category_id
     WHERE s.id = ? OR s.slug = ? LIMIT 1`,
    [idOrSlug, idOrSlug],
  );
  if (!rows[0]) throw new ApiError(404, 'Service not found', 'SERVICE_NOT_FOUND');
  const [reviews] = await pool.query(
    `SELECT r.rating, r.comment, r.created_at, u.name AS customer_name
     FROM reviews r
     JOIN orders o ON o.id = r.order_id
     JOIN customers cu ON cu.id = r.customer_id
     JOIN users u ON u.id = cu.user_id
     WHERE o.service_id = ? AND r.status = 'published'
     ORDER BY r.id DESC LIMIT 8`,
    [rows[0].id],
  );
  return { ...rows[0], reviews };
}

export async function saveService(body, image, id = null) {
  const [currentRows] = id
    ? await pool.query('SELECT * FROM services WHERE id = ?', [id])
    : [[]];
  const current = currentRows[0];
  if (id && !current) throw new ApiError(404, 'Service not found', 'SERVICE_NOT_FOUND');
  const prices = withFinalPrice(body, current);
  const slug = await uniqueSlug('services', body.slug || body.name || current.name, id);
  const payload = [
    body.categoryId ?? current?.category_id,
    body.name ?? current?.name,
    slug,
    body.description ?? current?.description ?? null,
    image || body.image || current?.image || null,
    body.basePrice ?? current?.base_price,
    body.durationMinutes ?? current?.duration_minutes ?? 60,
    body.taxPercent ?? current?.tax_percent ?? 0,
    body.discountAmount ?? current?.discount_amount ?? 0,
    body.discountPercent ?? current?.discount_percent ?? 0,
    prices.total,
    body.technicianCost ?? current?.technician_cost ?? 0,
    body.status ?? current?.status ?? 'active',
    body.featured === undefined ? (current?.featured ?? 0) : (body.featured ? 1 : 0),
    body.isAvailable === undefined ? (current?.is_available ?? 1) : (body.isAvailable ? 1 : 0),
    body.sortOrder ?? current?.sort_order ?? 0,
  ];
  if (id) {
    await pool.query(
      `UPDATE services SET category_id=?, name=?, slug=?, description=?, image=?, base_price=?, duration_minutes=?,
        tax_percent=?, discount_amount=?, discount_percent=?, final_price=?, technician_cost=?, status=?, featured=?, is_available=?, sort_order=?
       WHERE id=?`,
      [...payload, id],
    );
    return getService(id);
  }
  const [result] = await pool.query(
    `INSERT INTO services (
      category_id, name, slug, description, image, base_price, duration_minutes, tax_percent,
      discount_amount, discount_percent, final_price, technician_cost, status, featured, is_available, sort_order
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    payload,
  );
  return getService(result.insertId);
}

export async function deleteService(id) {
  const [used] = await pool.query('SELECT id FROM orders WHERE service_id = ? LIMIT 1', [id]);
  if (used[0]) {
    await pool.query("UPDATE services SET status = 'inactive', is_available = 0 WHERE id = ?", [id]);
    return { disabled: true };
  }
  await pool.query('DELETE FROM services WHERE id = ?', [id]);
  return { deleted: true };
}

export async function reorderServices(ids = []) {
  for (let i = 0; i < ids.length; i += 1) {
    await pool.query('UPDATE services SET sort_order = ? WHERE id = ?', [i + 1, ids[i]]);
  }
}

export async function publicReviews() {
  const [rows] = await pool.query(
    `SELECT r.rating, r.comment, r.created_at, u.name AS customer_name, s.name AS service_name, tu.name AS technician_name
     FROM reviews r
     JOIN customers cu ON cu.id = r.customer_id
     JOIN users u ON u.id = cu.user_id
     JOIN orders o ON o.id = r.order_id
     JOIN services s ON s.id = o.service_id
     JOIN technicians t ON t.id = r.technician_id
     JOIN users tu ON tu.id = t.user_id
     WHERE r.status = 'published'
     ORDER BY r.id DESC LIMIT 12`,
  );
  return rows;
}

export async function publicStats() {
  const [[services]] = await pool.query("SELECT COUNT(*) AS cnt FROM services WHERE status = 'active'");
  const [[techs]] = await pool.query("SELECT COUNT(*) AS cnt FROM technicians WHERE approval_status = 'approved'");
  const [[customers]] = await pool.query('SELECT COUNT(*) AS cnt FROM customers');
  const [[rating]] = await pool.query("SELECT ROUND(AVG(rating), 1) AS avg_rating FROM reviews WHERE status = 'published'");
  return {
    services: Number(services.cnt),
    technicians: Number(techs.cnt),
    customers: Number(customers.cnt),
    rating: Number(rating.avg_rating || 0),
  };
}
