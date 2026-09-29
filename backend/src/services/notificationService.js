import { pool } from '../config/db.js';
import { getIo } from './socket.js';

export async function notifyUser({ userId, title, message, type = 'info', link = null }) {
  if (!userId) return;
  const [result] = await pool.query(
    'INSERT INTO notifications (user_id, title, message, type, link) VALUES (?, ?, ?, ?, ?)',
    [userId, title, message, type, link],
  );
  const io = getIo();
  if (io) {
    io.to(`user:${userId}`).emit('notification:new', {
      id: result.insertId, title, message, type, link, is_read: 0, created_at: new Date().toISOString(),
    });
  }
}

export async function notifyAdmins({ title, message, type = 'info', link = null }) {
  const [admins] = await pool.query("SELECT id FROM users WHERE role = 'ADMIN' AND status = 'active'");
  await Promise.all(admins.map((admin) => notifyUser({ userId: admin.id, title, message, type, link })));
}
