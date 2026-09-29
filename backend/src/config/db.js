import mysql from 'mysql2/promise';
import { env } from './env.js';

export const pool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  waitForConnections: true,
  connectionLimit: process.env.VERCEL ? 3 : 10,
  namedPlaceholders: false,
  decimalNumbers: true,
  timezone: '+05:30',
  dateStrings: ['DATE', 'DATETIME', 'TIMESTAMP'],
});
