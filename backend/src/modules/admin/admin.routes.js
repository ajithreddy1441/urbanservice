import { Router } from 'express';
import { authenticate, requireAdmin } from '../../middleware/auth.js';
import { upload } from '../../middleware/upload.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/response.js';
import * as catalogController from '../catalog/catalog.controller.js';
import * as catalog from '../catalog/catalog.service.js';
import * as orders from '../orders/order.controller.js';
import * as tech from '../technician/technician.service.js';
import * as customers from '../customer/customer.service.js';
import * as admin from './admin.service.js';
import * as reports from '../reports/report.service.js';

const router = Router();
router.use(authenticate, requireAdmin);

router.get('/dashboard', asyncHandler(async (_req, res) => ok(res, await reports.adminDashboard())));
router.get('/orders', orders.list);
router.get('/orders/:id', orders.detail);
router.patch('/orders/:id', asyncHandler(async (req, res) => ok(res, await admin.adminUpdateOrder(req.params.id, req.body), 'Order updated')));
router.get('/orders/:id/candidates', orders.candidates);
router.post('/orders/:id/assign-technician', orders.assign);
router.post('/orders/:id/refund', orders.refund);
router.patch('/orders/:id/cancel', orders.cancel);

router.get('/customers', asyncHandler(async (req, res) => ok(res, await customers.adminCustomers(req.query))));
router.get('/customers/:id', asyncHandler(async (req, res) => ok(res, await customers.adminCustomer(req.params.id))));
router.patch('/customers/:id/status', asyncHandler(async (req, res) => {
  const customer = await customers.adminCustomer(req.params.id);
  await customers.setUserStatus(customer.user_id, req.body.status);
  return ok(res, null, 'Customer updated');
}));

router.get('/technicians', asyncHandler(async (req, res) => ok(res, await tech.adminListTechnicians(req.query))));
router.get('/technicians/:id', asyncHandler(async (req, res) => ok(res, await tech.adminTechnician(req.params.id))));
router.patch('/technicians/:id', asyncHandler(async (req, res) => ok(res, await tech.adminUpdateTechnician(req.params.id, req.body), 'Technician updated')));
router.patch('/technicians/:id/approval', asyncHandler(async (req, res) => ok(res, await tech.setApproval(req.params.id, req.body.status, req.user), 'Approval updated')));

router.get('/categories', asyncHandler(async (_req, res) => ok(res, await catalog.listCategories({ includeInactive: true }))));
router.post('/categories', upload.single('image'), catalogController.createCategory);
router.patch('/categories/:id', upload.single('image'), catalogController.updateCategory);
router.delete('/categories/:id', catalogController.removeCategory);

router.get('/services', asyncHandler(async (req, res) => ok(res, await catalog.listServices(req.query, { admin: true }))));
router.post('/services', upload.single('image'), catalogController.createService);
router.patch('/services/reorder/all', catalogController.reorder);
router.patch('/services/:id', upload.single('image'), catalogController.updateService);
router.delete('/services/:id', catalogController.removeService);

router.get('/pricing', asyncHandler(async (_req, res) => ok(res, await tech.listCosts())));
router.post('/pricing', asyncHandler(async (req, res) => ok(res, { id: await tech.saveCost(req.body) }, 'Cost saved', 201)));
router.patch('/pricing/:id', asyncHandler(async (req, res) => ok(res, { id: await tech.saveCost(req.body, req.params.id) }, 'Cost updated')));
router.delete('/pricing/:id', asyncHandler(async (req, res) => {
  await tech.deleteCost(req.params.id);
  return ok(res, null, 'Cost removed');
}));
router.get('/levels', asyncHandler(async (_req, res) => ok(res, await tech.listLevels())));
router.post('/levels', asyncHandler(async (req, res) => ok(res, { id: await tech.saveLevel(req.body) }, 'Level saved', 201)));
router.patch('/levels/:id', asyncHandler(async (req, res) => ok(res, { id: await tech.saveLevel(req.body, req.params.id) }, 'Level updated')));
router.delete('/levels/:id', asyncHandler(async (req, res) => {
  await tech.deleteLevel(req.params.id);
  return ok(res, null, 'Level deleted');
}));

router.get('/incentives', asyncHandler(async (_req, res) => ok(res, await admin.listIncentiveRules())));
router.post('/incentives', asyncHandler(async (req, res) => ok(res, { id: await admin.saveIncentive(req.body) }, 'Incentive saved', 201)));
router.patch('/incentives/:id', asyncHandler(async (req, res) => ok(res, { id: await admin.saveIncentive(req.body, req.params.id) }, 'Incentive updated')));
router.delete('/incentives/:id', asyncHandler(async (req, res) => {
  await admin.deleteIncentive(req.params.id);
  return ok(res, null, 'Incentive removed');
}));

router.get('/payments', asyncHandler(async (req, res) => ok(res, await customers.listPayments(req.user, req.query))));
router.get('/reports/:type', asyncHandler(async (req, res) => ok(res, await reports.runReport(req.params.type, req.query))));
router.get('/reports/:type/export', asyncHandler(async (req, res) => {
  const format = ['csv', 'xlsx', 'pdf'].includes(req.query.format) ? req.query.format : 'csv';
  const file = await reports.exportReport(req.params.type, req.query, format);
  await reports.logReport(req.user.id, req.params.type, req.query);
  res.setHeader('Content-Type', file.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
  return res.send(file.buffer);
}));

router.get('/map', asyncHandler(async (_req, res) => ok(res, await reports.liveMap())));
router.get('/settings', asyncHandler(async (_req, res) => ok(res, await admin.getAllSettings())));
router.put('/settings', asyncHandler(async (req, res) => ok(res, await admin.updateSettings(req.body.entries || []), 'Settings saved')));
router.get('/reviews', asyncHandler(async (req, res) => ok(res, await admin.listReviews(req.query))));
router.patch('/reviews/:id', asyncHandler(async (req, res) => {
  await admin.moderateReview(req.params.id, req.body.status);
  return ok(res, null, 'Review updated');
}));
router.get('/locations', asyncHandler(async (_req, res) => ok(res, await admin.listLocations())));
router.post('/locations', asyncHandler(async (req, res) => ok(res, { id: await admin.saveLocation(req.body) }, 'Location saved', 201)));
router.patch('/locations/:id', asyncHandler(async (req, res) => ok(res, { id: await admin.saveLocation(req.body, req.params.id) }, 'Location updated')));
router.delete('/locations/:id', asyncHandler(async (req, res) => {
  await admin.deleteLocation(req.params.id);
  return ok(res, null, 'Location removed');
}));
router.post('/notifications/broadcast', asyncHandler(async (req, res) => ok(res, await admin.broadcast(req.body), 'Notification sent')));

export default router;
