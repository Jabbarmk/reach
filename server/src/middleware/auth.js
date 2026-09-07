import jwt from 'jsonwebtoken';
import { pool } from '../db.js';

export const ALL_SCREENS = ['overview', 'members', 'approvals', 'payments', 'events', 'settings', 'users', 'form', 'ledger', 'committee'];

// In-memory cache of roles.name -> { label, screens }. Roles rarely change, so we cache them
// instead of hitting the DB on every request; refreshed on startup and whenever a role is created.
let roleCache = {};

export async function loadRoles() {
  const [rows] = await pool.query('SELECT name, label, screens FROM roles ORDER BY sort_order, id');
  const map = {};
  for (const r of rows) {
    let screens = [];
    try { screens = JSON.parse(r.screens).filter((s) => ALL_SCREENS.includes(s)); } catch { /* keep empty */ }
    map[r.name] = { label: r.label, screens };
  }
  roleCache = map;
  return map;
}

export const getRolesCache = () => roleCache;
export const getRoleDefaults = (roleName) => roleCache[roleName]?.screens || [];

export function screensForUser(user) {
  if (user.screens) {
    try {
      const list = JSON.parse(user.screens);
      if (Array.isArray(list) && list.length) return list.filter((s) => ALL_SCREENS.includes(s));
    } catch { /* fall through to role default */ }
  }
  return getRoleDefaults(user.role);
}

export function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    req.admin = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}

// Loads the fresh user row and checks screen access (role default or per-user override).
export function requireScreen(screen) {
  return async (req, res, next) => {
    try {
      const [rows] = await pool.query('SELECT * FROM admins WHERE id = ?', [req.admin.id]);
      const user = rows[0];
      if (!user || !user.is_active) return res.status(401).json({ error: 'Account disabled' });
      req.adminUser = user;
      req.adminScreens = screensForUser(user);
      if (!req.adminScreens.includes(screen)) {
        return res.status(403).json({ error: 'You do not have access to this section' });
      }
      next();
    } catch (e) { next(e); }
  };
}

// Like requireScreen, but passes if the user has ANY of the given screens
// (e.g. role management is reachable from both Users and Settings).
export function requireAnyScreen(...screens) {
  return async (req, res, next) => {
    try {
      const [rows] = await pool.query('SELECT * FROM admins WHERE id = ?', [req.admin.id]);
      const user = rows[0];
      if (!user || !user.is_active) return res.status(401).json({ error: 'Account disabled' });
      req.adminUser = user;
      req.adminScreens = screensForUser(user);
      if (!screens.some((s) => req.adminScreens.includes(s))) {
        return res.status(403).json({ error: 'You do not have access to this section' });
      }
      next();
    } catch (e) { next(e); }
  };
}
