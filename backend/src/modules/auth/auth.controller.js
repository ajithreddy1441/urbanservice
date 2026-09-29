import { body } from 'express-validator';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/response.js';
import { publicPath } from '../../middleware/upload.js';
import * as auth from './auth.service.js';

const passwordRule = body('password').isLength({ min: 8 }).matches(/[A-Za-z]/).matches(/[0-9]/).withMessage('Use at least 8 characters with letters and numbers');

export const registerRules = [
  body('name').trim().isLength({ min: 2, max: 120 }),
  body('email').isEmail().normalizeEmail(),
  body('phone').trim().isLength({ min: 10, max: 15 }),
  passwordRule,
];

export const technicianRules = [
  ...registerRules,
  body('city').optional().trim(),
  body('experienceYears').optional().isFloat({ min: 0, max: 60 }),
];

export const loginRules = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
];

export const register = asyncHandler(async (req, res) => {
  const data = await auth.registerCustomer(req.body);
  return ok(res, data, 'Account created', 201);
});

export const registerTechnician = asyncHandler(async (req, res) => {
  const files = {
    photo: publicPath(req.files?.photo?.[0]),
    govId: publicPath(req.files?.govId?.[0]),
    license: publicPath(req.files?.license?.[0]),
    certificates: (req.files?.certificates || []).map(publicPath),
  };
  const data = await auth.registerTechnician(req.body, files);
  return ok(res, data, 'Registration submitted for approval', 201);
});

export const login = asyncHandler(async (req, res) => {
  const data = await auth.login(req.body.email, req.body.password);
  return ok(res, data, 'Signed in');
});

export const refresh = asyncHandler(async (req, res) => {
  const data = await auth.refresh(req.body.refreshToken);
  return ok(res, data, 'Session refreshed');
});

export const logout = asyncHandler(async (req, res) => {
  await auth.logout(req.body.refreshToken);
  return ok(res, null, 'Signed out');
});

export const me = asyncHandler(async (req, res) => {
  return ok(res, await auth.presentUser(req.user.id));
});

export const updateMe = asyncHandler(async (req, res) => {
  const data = await auth.updateProfile(req.user, req.body, publicPath(req.file));
  return ok(res, data, 'Profile updated');
});

export const changePassword = asyncHandler(async (req, res) => {
  await auth.changePassword(req.user, req.body.currentPassword, req.body.newPassword);
  return ok(res, null, 'Password updated. Please sign in again.');
});
