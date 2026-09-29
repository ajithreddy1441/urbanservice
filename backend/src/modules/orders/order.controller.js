import { body, param } from 'express-validator';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/response.js';
import { publicPath } from '../../middleware/upload.js';
import * as orders from './order.service.js';

export const createRules = [
  body('serviceId').isInt({ min: 1 }),
  body('scheduledDate').isISO8601(),
  body('scheduledTime').matches(/^\d{2}:\d{2}(:\d{2})?$/),
  body('address.city').trim().notEmpty(),
  body('address.state').trim().notEmpty(),
  body('address.pincode').trim().notEmpty(),
  body('address.latitude').isFloat({ min: -90, max: 90 }),
  body('address.longitude').isFloat({ min: -180, max: 180 }),
];

export const list = asyncHandler(async (req, res) => {
  return ok(res, await orders.listOrders(req.query, req.user));
});

export const detail = asyncHandler(async (req, res) => {
  return ok(res, await orders.getOrder(req.params.id, req.user));
});

export const create = asyncHandler(async (req, res) => {
  return ok(res, await orders.createOrder(req.user, req.body), 'Booking confirmed', 201);
});

export const cancel = asyncHandler(async (req, res) => {
  return ok(res, await orders.cancelOrder(req.params.id, req.user, req.body.reason), 'Order cancelled');
});

export const reschedule = asyncHandler(async (req, res) => {
  return ok(res, await orders.rescheduleOrder(req.params.id, req.user, req.body), 'Order rescheduled');
});

export const status = asyncHandler(async (req, res) => {
  const images = (req.files || []).map(publicPath);
  return ok(res, await orders.updateOrderStatus(req.params.id, req.user, req.body.status, { note: req.body.note, images }), 'Status updated');
});

export const pay = asyncHandler(async (req, res) => {
  return ok(res, await orders.payOrder(req.params.id, req.user, req.body), 'Payment recorded');
});

export const review = asyncHandler(async (req, res) => {
  return ok(res, await orders.addReview(req.params.id, req.user, req.body), 'Review saved', 201);
});

export const track = asyncHandler(async (req, res) => {
  return ok(res, await orders.tracking(req.params.id, req.user));
});

export const assign = asyncHandler(async (req, res) => {
  return ok(res, await orders.assignTechnician(req.params.id, req.user, {
    technicianId: Number(req.body.technicianId),
    override: req.body.override === true || req.body.override === 'true',
    note: req.body.note,
  }), 'Technician assigned');
});

export const candidates = asyncHandler(async (req, res) => {
  return ok(res, await orders.candidateTechnicians(req.params.id, req.query));
});

export const refund = asyncHandler(async (req, res) => {
  return ok(res, await orders.refundOrder(req.params.id, req.user, req.body.reason), 'Refund recorded');
});

export const customerHome = asyncHandler(async (req, res) => {
  return ok(res, await orders.customerDashboard(req.user));
});

export const technicianHome = asyncHandler(async (req, res) => {
  return ok(res, await orders.technicianDashboard(req.user));
});

export const idRule = [param('id').isInt({ min: 1 })];
