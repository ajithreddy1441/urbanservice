import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { ApiError } from '../utils/ApiError.js';

const uploadRoot = path.resolve('uploads');
fs.mkdirSync(uploadRoot, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadRoot),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_').slice(-80);
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}-${safe}`);
  },
});

function fileFilter(_req, file, cb) {
  const ok = /^(image\/(jpeg|png|webp|gif)|application\/pdf)$/.test(file.mimetype);
  if (!ok) return cb(new ApiError(400, 'Only JPG, PNG, WEBP, GIF, and PDF files are allowed', 'INVALID_FILE'));
  return cb(null, true);
}

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

export function publicPath(file) {
  if (!file) return null;
  return `/uploads/${file.filename}`;
}
