import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate, requireAdmin, requireCustomer, requireTechnician } from '../../middleware/auth.js';
import { upload } from '../../middleware/upload.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './order.controller.js';

const router = Router();

router.post('/', authenticate, requireCustomer, validate(controller.createRules), controller.create);
router.get('/', authenticate, controller.list);
router.get('/:id', authenticate, controller.detail);
router.get('/:id/tracking', authenticate, controller.track);
router.patch('/:id/cancel', authenticate, controller.cancel);
router.patch(
  '/:id/reschedule',
  authenticate,
  validate([body('scheduledDate').isISO8601(), body('scheduledTime').matches(/^\d{2}:\d{2}(:\d{2})?$/)]),
  controller.reschedule,
);
router.patch('/:id/status', authenticate, requireTechnician, upload.array('images', 6), controller.status);
router.post('/:id/pay', authenticate, controller.pay);
router.post(
  '/:id/review',
  authenticate,
  requireCustomer,
  validate([body('rating').isInt({ min: 1, max: 5 })]),
  controller.review,
);
router.get('/:id/candidates', authenticate, requireAdmin, controller.candidates);
router.post('/:id/assign-technician', authenticate, requireAdmin, controller.assign);
router.post('/:id/refund', authenticate, requireAdmin, controller.refund);

export default router;
