import express from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';
import { requireAdmin, requireScreen, ALL_SCREENS, ROLE_DEFAULT_SCREENS, screensForUser } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAdmin, requireScreen('users'));

const publicUser = (u) => ({
  id: u.id,
  username: u.username,
  full_name: u.full_name,
  role: u.role,
  screens: screensForUser(u),
  has_override: Boolean(u.screens),
  is_active: Boolean(u.is_active),
  created_at: u.created_at,
});

router.get('/', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM admins ORDER BY created_at ASC');
    res.json({ users: rows.map(publicUser), roleDefaults: ROLE_DEFAULT_SCREENS, allScreens: ALL_SCREENS });
  } catch (e) { next(e); }
});

function normalizeScreens(screens, role) {
  if (!Array.isArray(screens)) return null;
  const clean = screens.filter((s) => ALL_SCREENS.includes(s));
  const defaults = ROLE_DEFAULT_SCREENS[role] || [];
  // Store NULL when it matches the role default (keeps user on the role preset).
  if (clean.length === defaults.length && defaults.every((s) => clean.includes(s))) return null;
  return JSON.stringify(clean);
}

router.post('/', async (req, res, next) => {
  try {
    const { username, full_name, password, role, screens } = req.body || {};
    if (!username?.trim() || !password || !['admin', 'staff', 'accounts'].includes(role)) {
      return res.status(400).json({ error: 'Username, password and a valid role are required' });
    }
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    const hash = await bcrypt.hash(password, 10);
    try {
      const [result] = await pool.query(
        'INSERT INTO admins (username, full_name, password_hash, role, screens) VALUES (?,?,?,?,?)',
        [username.trim().toLowerCase(), full_name?.trim() || null, hash, role, normalizeScreens(screens, role)]
      );
      const [rows] = await pool.query('SELECT * FROM admins WHERE id = ?', [result.insertId]);
      res.status(201).json({ user: publicUser(rows[0]) });
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Username already exists' });
      throw e;
    }
  } catch (e) { next(e); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM admins WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    const target = rows[0];
    const { full_name, password, role, screens, is_active } = req.body || {};

    const newRole = ['admin', 'staff', 'accounts'].includes(role) ? role : target.role;
    const newActive = typeof is_active === 'boolean' ? (is_active ? 1 : 0) : target.is_active;

    // Never lock out the last active admin.
    if (target.role === 'admin' && (newRole !== 'admin' || !newActive)) {
      const [[{ n }]] = await pool.query(
        "SELECT COUNT(*) AS n FROM admins WHERE role = 'admin' AND is_active = 1 AND id != ?", [target.id]
      );
      if (n === 0) return res.status(400).json({ error: 'Cannot demote or deactivate the last active admin' });
    }

    const updates = {
      full_name: full_name !== undefined ? (full_name?.trim() || null) : target.full_name,
      role: newRole,
      screens: screens !== undefined ? normalizeScreens(screens, newRole) : target.screens,
      is_active: newActive,
    };
    if (password) {
      if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
      updates.password_hash = await bcrypt.hash(password, 10);
    }
    const keys = Object.keys(updates);
    await pool.query(`UPDATE admins SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`, [...Object.values(updates), target.id]);
    const [fresh] = await pool.query('SELECT * FROM admins WHERE id = ?', [target.id]);
    res.json({ user: publicUser(fresh[0]) });
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (id === req.admin.id) return res.status(400).json({ error: 'You cannot delete your own account' });
    const [rows] = await pool.query('SELECT * FROM admins WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    if (rows[0].role === 'admin') {
      const [[{ n }]] = await pool.query("SELECT COUNT(*) AS n FROM admins WHERE role = 'admin' AND is_active = 1 AND id != ?", [id]);
      if (n === 0) return res.status(400).json({ error: 'Cannot delete the last active admin' });
    }
    await pool.query('DELETE FROM admins WHERE id = ?', [id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
