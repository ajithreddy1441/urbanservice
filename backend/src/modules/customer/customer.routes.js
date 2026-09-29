import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate, requireCustomer } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/response.js';
import * as orders from '../orders/order.controller.js';
import * as customer from './customer.service.js';

const router = Router();
router.use(authenticate, requireCustomer);

router.get('/dashboard', orders.customerHome);
router.get('/orders', orders.list);
router.get('/orders/:id', orders.detail);
router.post('/orders', validate(orders.createRules), orders.create);
router.patch('/orders/:id/cancel', orders.cancel);
router.patch('/orders/:id/reschedule', orders.reschedule);
router.post('/orders/:id/pay', orders.pay);
router.post('/orders/:id/review', validate([body('rating').isInt({ min: 1, max: 5 })]), orders.review);
router.get('/orders/:id/tracking', orders.track);

router.get('/addresses', asyncHandler(async (req, res) => ok(res, await customer.listAddresses(req.user.id))));
router.post('/addresses', asyncHandler(async (req, res) => ok(res, { id: await customer.saveAddress(req.user.id, req.body) }, 'Address saved', 201)));
router.put('/addresses/:id', asyncHandler(async (req, res) => ok(res, { id: await customer.saveAddress(req.user.id, req.body, req.params.id) }, 'Address updated')));
router.delete('/addresses/:id', asyncHandler(async (req, res) => {
  await customer.deleteAddress(req.user.id, req.params.id);
  return ok(res, null, 'Address removed');
}));
router.get('/payments', asyncHandler(async (req, res) => ok(res, await customer.listPayments(req.user, req.query))));
router.get('/notifications', asyncHandler(async (req, res) => ok(res, await customer.listNotifications(req.user.id))));
router.patch('/notifications/:id/read', asyncHandler(async (req, res) => {
  await customer.markNotifications(req.user.id, req.params.id);
  return ok(res, null, 'Updated');
}));
router.patch('/notifications/read-all', asyncHandler(async (req, res) => {
  await customer.markNotifications(req.user.id);
  return ok(res, null, 'Updated');
}));
router.get('/reviews', asyncHandler(async (req, res) => ok(res, await customer.myReviews(req.user.id))));

export default router;
