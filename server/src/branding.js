import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { pool } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const BRANDING_DIR = path.join(__dirname, '..', 'branding');

// Absolute path to the currently active society logo (admin-uploaded, falling back to the default).
export async function getLogoPath() {
  let file = 'logo_default.jpeg';
  try {
    const [rows] = await pool.query("SELECT value FROM settings WHERE name = 'logo'");
    if (rows.length) {
      const cfg = JSON.parse(rows[0].value);
      if (cfg.file && fs.existsSync(path.join(BRANDING_DIR, path.basename(cfg.file)))) file = cfg.file;
    }
  } catch { /* fall back to default */ }
  return path.join(BRANDING_DIR, path.basename(file));
}
