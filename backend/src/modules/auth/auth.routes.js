import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../../middleware/auth.js';
import { upload } from '../../middleware/upload.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './auth.controller.js';

const router = Router();

router.post('/register', validate(controller.registerRules), controller.register);
router.post(
  '/register/technician',
  upload.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'govId', maxCount: 1 },
    { name: 'license', maxCount: 1 },
    { name: 'certificates', maxCount: 5 },
  ]),
  validate(controller.technicianRules),
  controller.registerTechnician,
);
router.post('/login', validate(controller.loginRules), controller.login);
router.post('/refresh', controller.refresh);
router.post('/logout', controller.logout);
router.get('/me', authenticate, controller.me);
router.patch('/profile', authenticate, upload.single('avatar'), controller.updateMe);
router.post(
  '/change-password',
  authenticate,
  validate([
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 8 }).matches(/[A-Za-z]/).matches(/[0-9]/),
  ]),
  controller.changePassword,
);

export default router;
