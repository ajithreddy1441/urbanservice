import dotenv from 'dotenv';

dotenv.config();

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    if (fallback !== undefined) return fallback;
  }
  return value ?? '';
}

export const env = {
  port: Number(process.env.PORT || 5000),
  nodeEnv: process.env.NODE_ENV || 'development',
  timezone: process.env.APP_TIMEZONE || 'Asia/Kolkata',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'urban_services',
  },
  jwtSecret: required('JWT_SECRET', 'dev-only-change-me'),
  jwtExpires: process.env.JWT_EXPIRES_IN || '1d',
  jwtRefreshSecret: required('JWT_REFRESH_SECRET', 'dev-refresh-change-me'),
  jwtRefreshExpires: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASSWORD || '',
    fromName: process.env.SMTP_FROM_NAME || 'Urban Services',
    fromEmail: process.env.SMTP_FROM_EMAIL || 'noreply@urbanservices.local',
  },
  googleMapsKey: process.env.GOOGLE_MAPS_API_KEY || '',
  paymentSecret: process.env.PAYMENT_SECRET || '',
};
