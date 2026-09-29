import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { pool } from '../config/db.js';

let io;

export function initSocket(server) {
  io = new Server(server, {
    cors: { origin: env.corsOrigins, credentials: true },
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('UNAUTHENTICATED'));
      const payload = jwt.verify(token, env.jwtSecret);
      socket.user = payload;
      return next();
    } catch {
      return next(new Error('INVALID_TOKEN'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.user.id}`);
    socket.join(`role:${socket.user.role}`);

    socket.on('track:join', async (orderId) => {
      try {
        const allowed = await canWatchOrder(socket.user, Number(orderId));
        if (allowed) socket.join(`order:${orderId}`);
      } catch {
        /* ignore unauthorized joins */
      }
    });
  });

  return io;
}

export function getIo() {
  return io;
}

async function canWatchOrder(user, orderId) {
  const [rows] = await pool.query(
    `SELECT o.id, cu.user_id AS customer_user_id, tu.user_id AS technician_user_id
     FROM orders o
     JOIN customers cu ON cu.id = o.customer_id
     LEFT JOIN technicians t ON t.id = o.technician_id
     LEFT JOIN users tu ON tu.id = t.user_id
     WHERE o.id = ?`,
    [orderId],
  );
  const order = rows[0];
  if (!order) return false;
  if (user.role === 'ADMIN') return true;
  if (user.role === 'CUSTOMER' && order.customer_user_id === user.id) return true;
  if (user.role === 'TECHNICIAN' && order.technician_user_id === user.id) return true;
  return false;
}

export function emitOrder(order, event = 'order:updated') {
  if (!io || !order) return;
  io.to('role:ADMIN').emit(event, { orderId: order.id, status: order.order_status, orderNumber: order.order_number });
  if (order.customer_user_id) io.to(`user:${order.customer_user_id}`).emit(event, { orderId: order.id, status: order.order_status });
  if (order.technician_user_id) io.to(`user:${order.technician_user_id}`).emit(event, { orderId: order.id, status: order.order_status });
  io.to(`order:${order.id}`).emit(event, { orderId: order.id, status: order.order_status });
}

export function emitLocation(payload) {
  if (!io) return;
  io.to('role:ADMIN').emit('technician:location', payload);
  if (payload.orderId) io.to(`order:${payload.orderId}`).emit('technician:location', payload);
}
