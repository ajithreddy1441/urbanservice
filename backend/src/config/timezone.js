import dotenv from 'dotenv';

dotenv.config();
process.env.TZ = process.env.APP_TIMEZONE || 'Asia/Kolkata';
