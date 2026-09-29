import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { pool } from '../../config/db.js';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';
import { customerByUser, technicianByUser } from '../orders/order.model.js';
import { notifyAdmins } from '../../services/notificationService.js';

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function signAccess(user) {
  return jwt.sign({ id: user.id, role: user.role, name: user.name }, env.jwtSecret, { expiresIn: env.jwtExpires });
}

async function issueRefresh(userId) {
  const token = crypto.randomBytes(48).toString('hex');
  const expires = new Date();
  expires.setDate(expires.getDate() + 30);
  await pool.query(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
    [userId, hashToken(token), expires],
  );
  return token;
}

export async function presentUser(userId) {
  const [rows] = await pool.query(
    'SELECT id, role, name, email, phone, avatar, status, created_at FROM users WHERE id = ?',
    [userId],
  );
  const user = rows[0];
  if (!user) return null;
  if (user.role === 'CUSTOMER') user.customer = await customerByUser(userId);
  if (user.role === 'TECHNICIAN') {
    user.technician = await technicianByUser(userId);
    if (user.technician) {
      const [services] = await pool.query(
        `SELECT s.id, s.name FROM technician_services ts JOIN services s ON s.id = ts.service_id WHERE ts.technician_id = ?`,
        [user.technician.id],
      );
      user.technician.services = services;
      const [docs] = await pool.query(
        'SELECT id, doc_type, file_path, created_at FROM technician_documents WHERE technician_id = ?',
        [user.technician.id],
      );
      user.technician.documents = docs;
    }
  }
  return user;
}

async function authPayload(user) {
  return {
    accessToken: signAccess(user),
    refreshToken: await issueRefresh(user.id),
    user: await presentUser(user.id),
  };
}

export async function registerCustomer(body) {
  const [existing] = await pool.query('SELECT id FROM users WHERE email = ? OR phone = ?', [body.email, body.phone]);
  if (existing[0]) throw new ApiError(409, 'An account with this email or phone already exists', 'ACCOUNT_EXISTS');
  const passwordHash = await bcrypt.hash(body.password, 10);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [user] = await conn.query(
      `INSERT INTO users (role, name, email, phone, password_hash, avatar) VALUES ('CUSTOMER', ?, ?, ?, ?, ?)`,
      [body.name, body.email.toLowerCase(), body.phone, passwordHash, body.avatar || null],
    );
    await conn.query(
      `INSERT INTO customers (user_id, address, city, state, pincode) VALUES (?, ?, ?, ?, ?)`,
      [user.insertId, body.address || null, body.city || null, body.state || null, body.pincode || null],
    );
    await conn.commit();
    const created = { id: user.insertId, role: 'CUSTOMER', name: body.name };
    await notifyAdmins({
      title: 'New customer',
      message: `${body.name} created an account.`,
      type: 'customer',
      link: '/admin/customers',
    });
    return authPayload(created);
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function registerTechnician(body, files = {}) {
  const [existing] = await pool.query('SELECT id FROM users WHERE email = ? OR phone = ?', [body.email, body.phone]);
  if (existing[0]) throw new ApiError(409, 'An account with this email or phone already exists', 'ACCOUNT_EXISTS');
  const passwordHash = await bcrypt.hash(body.password, 10);
  const serviceIds = Array.isArray(body.serviceIds) ? body.serviceIds : String(body.serviceIds || '').split(',').filter(Boolean);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [user] = await conn.query(
      `INSERT INTO users (role, name, email, phone, password_hash, avatar) VALUES ('TECHNICIAN', ?, ?, ?, ?, ?)`,
      [body.name, body.email.toLowerCase(), body.phone, passwordHash, files.photo || null],
    );
    const [tech] = await conn.query(
      `INSERT INTO technicians (
        user_id, dob, address, city, state, pincode, experience_years, level_id, bio,
        approval_status, upi_id, bank_name, bank_account, bank_ifsc, base_latitude, base_longitude,
        gov_id_path, license_path
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user.insertId, body.dob || null, body.address || null, body.city || null, body.state || null, body.pincode || null,
        body.experienceYears || 0, body.levelId || null, body.bio || null, body.upiId || null, body.bankName || null,
        body.bankAccount || null, body.bankIfsc || null, body.latitude || null, body.longitude || null,
        files.govId || null, files.license || null,
      ],
    );
    for (const serviceId of serviceIds) {
      await conn.query('INSERT IGNORE INTO technician_services (technician_id, service_id) VALUES (?, ?)', [tech.insertId, serviceId]);
    }
    for (const file of files.certificates || []) {
      await conn.query(
        `INSERT INTO technician_documents (technician_id, doc_type, file_path) VALUES (?, 'certificate', ?)`,
        [tech.insertId, file],
      );
    }
    await conn.commit();
    await notifyAdmins({
      title: 'Technician registration',
      message: `${body.name} is waiting for approval.`,
      type: 'technician',
      link: '/admin/technicians',
    });
    return authPayload({ id: user.insertId, role: 'TECHNICIAN', name: body.name });
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function login(email, password) {
  const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
  const user = rows[0];
  if (!user) throw new ApiError(401, 'Email or password is incorrect', 'INVALID_CREDENTIALS');
  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) throw new ApiError(401, 'Email or password is incorrect', 'INVALID_CREDENTIALS');
  if (user.status !== 'active') throw new ApiError(403, 'This account is suspended', 'ACCOUNT_INACTIVE');
  return authPayload(user);
}

export async function refresh(token) {
  if (!token) throw new ApiError(401, 'Refresh token is required', 'UNAUTHENTICATED');
  const [rows] = await pool.query(
    `SELECT rt.id, rt.user_id, u.role, u.name, u.status
     FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id
     WHERE rt.token_hash = ? AND rt.expires_at > NOW()`,
    [hashToken(token)],
  );
  const row = rows[0];
  if (!row || row.status !== 'active') throw new ApiError(401, 'Session expired. Please sign in again', 'INVALID_TOKEN');
  await pool.query('DELETE FROM refresh_tokens WHERE id = ?', [row.id]);
  return authPayload({ id: row.user_id, role: row.role, name: row.name });
}

export async function logout(token) {
  if (!token) return;
  await pool.query('DELETE FROM refresh_tokens WHERE token_hash = ?', [hashToken(token)]);
}

export async function updateProfile(user, body, avatar) {
  const fields = [];
  const params = [];
  if (body.name) { fields.push('name = ?'); params.push(body.name); }
  if (body.phone) { fields.push('phone = ?'); params.push(body.phone); }
  if (avatar) { fields.push('avatar = ?'); params.push(avatar); }
  if (fields.length) {
    params.push(user.id);
    await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params);
  }
  if (user.role === 'CUSTOMER') {
    await pool.query(
      `UPDATE customers SET address = COALESCE(?, address), city = COALESCE(?, city), state = COALESCE(?, state), pincode = COALESCE(?, pincode) WHERE user_id = ?`,
      [body.address ?? null, body.city ?? null, body.state ?? null, body.pincode ?? null, user.id],
    );
  }
  if (user.role === 'TECHNICIAN') {
    const tech = await technicianByUser(user.id);
    await pool.query(
      `UPDATE technicians SET dob = COALESCE(?, dob), address = COALESCE(?, address), city = COALESCE(?, city),
        state = COALESCE(?, state), pincode = COALESCE(?, pincode), bio = COALESCE(?, bio),
        upi_id = COALESCE(?, upi_id), bank_name = COALESCE(?, bank_name), bank_account = COALESCE(?, bank_account),
        bank_ifsc = COALESCE(?, bank_ifsc) WHERE id = ?`,
      [body.dob ?? null, body.address ?? null, body.city ?? null, body.state ?? null, body.pincode ?? null, body.bio ?? null, body.upiId ?? null, body.bankName ?? null, body.bankAccount ?? null, body.bankIfsc ?? null, tech.id],
    );
  }
  return presentUser(user.id);
}

export async function changePassword(user, currentPassword, nextPassword) {
  const [rows] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [user.id]);
  const match = await bcrypt.compare(currentPassword, rows[0].password_hash);
  if (!match) throw new ApiError(400, 'Current password is incorrect', 'INVALID_PASSWORD');
  const passwordHash = await bcrypt.hash(nextPassword, 10);
  await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, user.id]);
  await pool.query('DELETE FROM refresh_tokens WHERE user_id = ?', [user.id]);
}
