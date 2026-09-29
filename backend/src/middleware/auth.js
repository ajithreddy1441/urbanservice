import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

export async function authenticate(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new ApiError(401, 'Please sign in to continue', 'UNAUTHENTICATED');
    let payload;
    try {
      payload = jwt.verify(token, env.jwtSecret);
    } catch {
      throw new ApiError(401, 'Your session has expired. Please sign in again', 'INVALID_TOKEN');
    }
    const [rows] = await pool.query(
      'SELECT id, role, name, email, phone, avatar, status FROM users WHERE id = ?',
      [payload.id],
    );
    const user = rows[0];
    if (!user || user.status !== 'active') {
      throw new ApiError(401, 'This account is not active', 'ACCOUNT_INACTIVE');
    }
    req.user = user;
    return next();
  } catch (error) {
    return next(error);
  }
}

export function requireRoles(...roles) {
  return (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new ApiError(403, 'You do not have access to this resource', 'FORBIDDEN'));
    }
    return next();
  };
}

export const requireAdmin = requireRoles('ADMIN');
export const requireCustomer = requireRoles('CUSTOMER');
export const requireTechnician = requireRoles('TECHNICIAN');
