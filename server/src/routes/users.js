import express from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';
import { requireAdmin, requireScreen, requireAnyScreen, ALL_SCREENS, getRolesCache, getRoleDefaults, screensForUser, loadRoles } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAdmin);

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

const roleDefaultsMap = () => Object.fromEntries(Object.entries(getRolesCache()).map(([name, r]) => [name, r.screens]));
const rolesList = () => Object.entries(getRolesCache()).map(([name, r]) => ({ name, label: r.label }));

router.get('/', requireScreen('users'), async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM admins ORDER BY created_at ASC');
    res.json({ users: rows.map(publicUser), roleDefaults: roleDefaultsMap(), allScreens: ALL_SCREENS, roles: rolesList() });
  } catch (e) { next(e); }
});

/* ===== Roles (reachable from Users or Settings) ===== */
router.get('/roles', requireAnyScreen('users', 'settings'), async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT name, label, screens, is_system FROM roles ORDER BY sort_order, id');
    res.json({ roles: rows.map((r) => ({ name: r.name, label: r.label, screens: JSON.parse(r.screens), is_system: Boolean(r.is_system) })) });
  } catch (e) { next(e); }
});

router.post('/roles', requireAnyScreen('users', 'settings'), async (req, res, next) => {
  try {
    const { label, screens } = req.body || {};
    if (!label?.trim()) return res.status(400).json({ error: 'Role name is required' });
    const name = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30);
    if (!name) return res.status(400).json({ error: 'Role name must contain at least one letter or number' });

    const clean = Array.isArray(screens) ? screens.filter((s) => ALL_SCREENS.includes(s)) : [];
    const [[{ maxSort }]] = await pool.query('SELECT COALESCE(MAX(sort_order),0) AS maxSort FROM roles');
    try {
      await pool.query(
        'INSERT INTO roles (name, label, screens, is_system, sort_order) VALUES (?,?,?,0,?)',
        [name, label.trim(), JSON.stringify(clean), maxSort + 1]
      );
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: `A role named "${label.trim()}" already exists` });
      throw e;
    }
    await loadRoles();
    res.status(201).json({ role: { name, label: label.trim(), screens: clean } });
  } catch (e) { next(e); }
});

router.put('/roles/:name', requireAnyScreen('users', 'settings'), async (req, res, next) => {
  try {
    const { label, screens } = req.body || {};
    const [rows] = await pool.query('SELECT * FROM roles WHERE name = ?', [req.params.name]);
    if (!rows.length) return res.status(404).json({ error: 'Role not found' });
    const role = rows[0];
    const newLabel = label !== undefined ? label.trim() : role.label;
    if (!newLabel) return res.status(400).json({ error: 'Role name cannot be empty' });
    const clean = Array.isArray(screens) ? screens.filter((s) => ALL_SCREENS.includes(s)) : JSON.parse(role.screens);
    await pool.query('UPDATE roles SET label = ?, screens = ? WHERE name = ?', [newLabel, JSON.stringify(clean), role.name]);
    await loadRoles();
    res.json({ role: { name: role.name, label: newLabel, screens: clean, is_system: Boolean(role.is_system) } });
  } catch (e) { next(e); }
});

router.delete('/roles/:name', requireAnyScreen('users', 'settings'), async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM roles WHERE name = ?', [req.params.name]);
    if (!rows.length) return res.status(404).json({ error: 'Role not found' });
    const role = rows[0];
    if (role.name === 'admin') return res.status(400).json({ error: 'The Admin role cannot be deleted' });
    const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM admins WHERE role = ?', [role.name]);
    if (n > 0) return res.status(400).json({ error: `${n} user(s) still have this role — reassign them to another role first` });
    await pool.query('DELETE FROM roles WHERE name = ?', [role.name]);
    await loadRoles();
    res.json({ ok: true });
  } catch (e) { next(e); }
});

function normalizeScreens(screens, role) {
  if (!Array.isArray(screens)) return null;
  const clean = screens.filter((s) => ALL_SCREENS.includes(s));
  const defaults = getRoleDefaults(role);
  // Store NULL when it matches the role default (keeps user on the role preset).
  if (clean.length === defaults.length && defaults.every((s) => clean.includes(s))) return null;
  return JSON.stringify(clean);
}

router.post('/', requireScreen('users'), async (req, res, next) => {
  try {
    const { username, full_name, password, role, screens } = req.body || {};
    if (!username?.trim() || !password || !getRolesCache()[role]) {
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

router.put('/:id', requireScreen('users'), async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM admins WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    const target = rows[0];
    const { full_name, password, role, screens, is_active } = req.body || {};

    const newRole = role && getRolesCache()[role] ? role : target.role;
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

router.delete('/:id', requireScreen('users'), async (req, res, next) => {
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
