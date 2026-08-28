import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { pool } from './db.js';
dotenv.config();

const username = process.env.ADMIN_USERNAME || 'admin';
const password = process.env.ADMIN_PASSWORD || 'reach@2026';

const hash = await bcrypt.hash(password, 10);
await pool.query(
  'INSERT INTO admins (username, password_hash) VALUES (?, ?) ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)',
  [username, hash]
);
console.log(`Admin user "${username}" is ready.`);
process.exit(0);
