import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/response.js';
import { publicPath } from '../../middleware/upload.js';
import * as catalog from './catalog.service.js';
import { publicSettings } from '../../services/settingsService.js';
import { pool } from '../../config/db.js';

export const categories = asyncHandler(async (req, res) => {
  return ok(res, await catalog.listCategories({ includeInactive: req.user?.role === 'ADMIN' && req.query.all === '1' }));
});

export const services = asyncHandler(async (req, res) => {
  return ok(res, await catalog.listServices(req.query, { admin: req.user?.role === 'ADMIN' && req.query.all === '1' }));
});

export const service = asyncHandler(async (req, res) => {
  return ok(res, await catalog.getService(req.params.id));
});

export const reviews = asyncHandler(async (_req, res) => {
  return ok(res, await catalog.publicReviews());
});

export const stats = asyncHandler(async (_req, res) => {
  return ok(res, await catalog.publicStats());
});

export const settings = asyncHandler(async (_req, res) => {
  return ok(res, await publicSettings());
});

export const locations = asyncHandler(async (_req, res) => {
  const [rows] = await pool.query('SELECT * FROM locations WHERE is_serviceable = 1 ORDER BY city, name');
  return ok(res, rows);
});

export const createCategory = asyncHandler(async (req, res) => {
  const id = await catalog.saveCategory({ ...req.body, image: publicPath(req.file) || req.body.image });
  return ok(res, { id }, 'Category saved', 201);
});

export const updateCategory = asyncHandler(async (req, res) => {
  const id = await catalog.saveCategory({ ...req.body, image: publicPath(req.file) || req.body.image }, req.params.id);
  return ok(res, { id }, 'Category updated');
});

export const removeCategory = asyncHandler(async (req, res) => {
  await catalog.deleteCategory(req.params.id);
  return ok(res, null, 'Category deleted');
});

export const createService = asyncHandler(async (req, res) => {
  const data = await catalog.saveService(normalizeService(req.body), publicPath(req.file));
  return ok(res, data, 'Service created', 201);
});

export const updateService = asyncHandler(async (req, res) => {
  const data = await catalog.saveService(normalizeService(req.body), publicPath(req.file), req.params.id);
  return ok(res, data, 'Service updated');
});

export const removeService = asyncHandler(async (req, res) => {
  const data = await catalog.deleteService(req.params.id);
  return ok(res, data, data.disabled ? 'Service disabled because it has orders' : 'Service deleted');
});

export const reorder = asyncHandler(async (req, res) => {
  await catalog.reorderServices(req.body.ids || []);
  return ok(res, null, 'Order updated');
});

function normalizeService(body) {
  const bool = (value) => value === true || value === 'true' || value === '1' || value === 1;
  return {
    ...body,
    categoryId: body.categoryId || body.category_id,
    basePrice: body.basePrice ?? body.base_price,
    durationMinutes: body.durationMinutes ?? body.duration_minutes,
    taxPercent: body.taxPercent ?? body.tax_percent,
    discountAmount: body.discountAmount ?? body.discount_amount,
    discountPercent: body.discountPercent ?? body.discount_percent,
    technicianCost: body.technicianCost ?? body.technician_cost,
    sortOrder: body.sortOrder ?? body.sort_order,
    featured: body.featured === undefined ? undefined : bool(body.featured),
    isAvailable: body.isAvailable === undefined && body.is_available === undefined
      ? undefined
      : bool(body.isAvailable ?? body.is_available),
  };
}
