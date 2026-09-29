import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate, requireTechnician } from '../../middleware/auth.js';
import { upload } from '../../middleware/upload.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/response.js';
import * as orders from '../orders/order.controller.js';
import * as tech from './technician.service.js';
import * as orderService from '../orders/order.service.js';
import * as customer from '../customer/customer.service.js';

const router = Router();
router.use(authenticate, requireTechnician);

router.get('/dashboard', orders.technicianHome);
router.get('/orders', orders.list);
router.get('/orders/:id', orders.detail);
router.post('/orders/:id/accept', asyncHandler(async (req, res) => {
  return ok(res, await orderService.updateOrderStatus(req.params.id, req.user, 'accepted', { note: req.body.note }), 'Job accepted');
}));
router.post('/orders/:id/reject', asyncHandler(async (req, res) => {
  return ok(res, await orderService.updateOrderStatus(req.params.id, req.user, 'rejected', { note: req.body.note }), 'Job rejected');
}));
router.patch('/orders/:id/status', upload.array('images', 6), orders.status);
router.post('/orders/:id/pay', orders.pay);
router.post(
  '/location',
  validate([body('latitude').isFloat(), body('longitude').isFloat()]),
  asyncHandler(async (req, res) => ok(res, await orderService.saveTechnicianLocation(req.user, req.body), 'Location updated')),
);
router.get('/earnings', asyncHandler(async (req, res) => ok(res, await tech.listEarnings(req.user))));
router.get('/incentives', asyncHandler(async (req, res) => ok(res, await tech.listIncentives(req.user))));
router.get('/reports/sales', asyncHandler(async (req, res) => ok(res, await tech.salesReport(req.user, req.query.period || 'daily'))));
router.get('/reports/sales/export', asyncHandler(async (req, res) => {
  const data = await tech.salesReport(req.user, req.query.period || 'daily');
  const lines = ['label,jobs,earnings', ...data.trend.map((row) => `${row.label},${row.jobs},${row.earnings}`)];
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="technician-sales.csv"');
  return res.send(lines.join('\n'));
}));
router.get('/customers', asyncHandler(async (req, res) => ok(res, await tech.myCustomers(req.user))));
router.patch('/availability', asyncHandler(async (req, res) => ok(res, await tech.setAvailability(req.user, req.body), 'Availability updated')));
router.get('/payments', asyncHandler(async (req, res) => ok(res, await customer.listPayments(req.user, req.query))));
router.get('/notifications', asyncHandler(async (req, res) => ok(res, await customer.listNotifications(req.user.id))));
router.patch('/notifications/read-all', asyncHandler(async (req, res) => {
  await customer.markNotifications(req.user.id);
  return ok(res, null, 'Updated');
}));

export default router;
