import express from 'express';
import { pool } from '../db.js';
import { requireAdmin, requireScreen } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAdmin, requireScreen('ledger'));

const KINDS = ['received', 'expense'];

function requireAdminRole(req, res) {
  if (req.adminUser.role !== 'admin') {
    res.status(403).json({ error: 'Only administrators can do this' });
    return false;
  }
  return true;
}

/* ===== Categories ===== */
router.get('/categories', async (req, res, next) => {
  try {
    const { kind } = req.query;
    let sql = 'SELECT * FROM ledger_categories';
    const params = [];
    if (kind) { sql += ' WHERE kind = ?'; params.push(kind); }
    sql += ' ORDER BY kind, sort_order, id';
    const [rows] = await pool.query(sql, params);
    res.json({ categories: rows });
  } catch (e) { next(e); }
});

router.post('/categories', async (req, res, next) => {
  try {
    if (!requireAdminRole(req, res)) return;
    const { kind, name } = req.body || {};
    if (!KINDS.includes(kind)) return res.status(400).json({ error: 'A valid kind (received or expense) is required' });
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
    const [[{ maxSort }]] = await pool.query('SELECT COALESCE(MAX(sort_order),0) AS maxSort FROM ledger_categories WHERE kind = ?', [kind]);
    try {
      const [result] = await pool.query(
        'INSERT INTO ledger_categories (kind, name, sort_order) VALUES (?,?,?)',
        [kind, name.trim(), maxSort + 1]
      );
      res.status(201).json({ category: { id: result.insertId, kind, name: name.trim(), sort_order: maxSort + 1 } });
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'This category already exists' });
      throw e;
    }
  } catch (e) { next(e); }
});

router.put('/categories/:id', async (req, res, next) => {
  try {
    if (!requireAdminRole(req, res)) return;
    const { name } = req.body || {};
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
    try {
      await pool.query('UPDATE ledger_categories SET name = ? WHERE id = ?', [name.trim(), req.params.id]);
      res.json({ ok: true });
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'This category already exists' });
      throw e;
    }
  } catch (e) { next(e); }
});

router.delete('/categories/:id', async (req, res, next) => {
  try {
    if (!requireAdminRole(req, res)) return;
    await pool.query('DELETE FROM ledger_categories WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/* ===== Entries ===== */
router.get('/entries', async (req, res, next) => {
  try {
    const { kind, from, to, category_id, search } = req.query;
    let sql = 'SELECT * FROM ledger_entries WHERE deleted_at IS NULL';
    const params = [];
    if (kind) { sql += ' AND kind = ?'; params.push(kind); }
    if (from) { sql += ' AND entry_date >= ?'; params.push(from); }
    if (to) { sql += ' AND entry_date <= ?'; params.push(to); }
    if (category_id) { sql += ' AND category_id = ?'; params.push(category_id); }
    if (search) {
      sql += ' AND (category_name LIKE ? OR note LIKE ? OR recorded_by LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    sql += ' ORDER BY entry_date DESC, id DESC LIMIT 500';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (e) { next(e); }
});

router.post('/entries', async (req, res, next) => {
  try {
    const { kind, category_id, amount, entry_date, method, note } = req.body || {};
    if (!KINDS.includes(kind)) return res.status(400).json({ error: 'A valid kind (received or expense) is required' });
    const amt = Number(amount);
    if (!(amt > 0)) return res.status(400).json({ error: 'A valid amount is required' });
    if (!entry_date || isNaN(Date.parse(entry_date))) return res.status(400).json({ error: 'A valid date is required' });

    let categoryName = null;
    if (category_id) {
      const [[cat]] = await pool.query('SELECT * FROM ledger_categories WHERE id = ?', [category_id]);
      if (!cat || cat.kind !== kind) return res.status(400).json({ error: 'Category does not match the selected type' });
      categoryName = cat.name;
    } else {
      return res.status(400).json({ error: 'Category is required' });
    }

    const [result] = await pool.query(
      'INSERT INTO ledger_entries (kind, category_id, category_name, amount, entry_date, method, note, recorded_by) VALUES (?,?,?,?,?,?,?,?)',
      [kind, category_id, categoryName, amt, entry_date, method?.trim() || null, note?.trim() || null, req.admin.username]
    );
    const [[entry]] = await pool.query('SELECT * FROM ledger_entries WHERE id = ?', [result.insertId]);
    res.status(201).json({ entry });
  } catch (e) { next(e); }
});

router.put('/entries/:id', async (req, res, next) => {
  try {
    if (!requireAdminRole(req, res)) return;
    const [[existing]] = await pool.query('SELECT * FROM ledger_entries WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Entry not found' });

    const { category_id, amount, entry_date, method, note } = req.body || {};
    const updates = { category_id: existing.category_id, category_name: existing.category_name, amount: existing.amount, entry_date: existing.entry_date, method: existing.method, note: existing.note };

    if (category_id !== undefined && Number(category_id) !== existing.category_id) {
      const [[cat]] = await pool.query('SELECT * FROM ledger_categories WHERE id = ?', [category_id]);
      if (!cat || cat.kind !== existing.kind) return res.status(400).json({ error: 'Category does not match the entry type' });
      updates.category_id = category_id;
      updates.category_name = cat.name;
    }
    if (amount !== undefined) {
      const amt = Number(amount);
      if (!(amt > 0)) return res.status(400).json({ error: 'A valid amount is required' });
      updates.amount = amt;
    }
    if (entry_date !== undefined) {
      if (!entry_date || isNaN(Date.parse(entry_date))) return res.status(400).json({ error: 'A valid date is required' });
      updates.entry_date = entry_date;
    }
    if (method !== undefined) updates.method = method?.trim() || null;
    if (note !== undefined) updates.note = note?.trim() || null;

    await pool.query(
      'UPDATE ledger_entries SET category_id=?, category_name=?, amount=?, entry_date=?, method=?, note=? WHERE id = ?',
      [updates.category_id, updates.category_name, updates.amount, updates.entry_date, updates.method, updates.note, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/entries/:id', async (req, res, next) => {
  try {
    if (!requireAdminRole(req, res)) return;
    await pool.query('UPDATE ledger_entries SET deleted_at = NOW() WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/* ===== Reports ===== */
router.get('/reports/summary', async (req, res, next) => {
  try {
    const now = new Date();
    const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
    const from = req.query.from || defaultFrom;
    const to = req.query.to || defaultTo;

    const [rangeRows] = await pool.query(
      `SELECT kind, category_name, SUM(amount) AS total, COUNT(*) AS count
       FROM ledger_entries
       WHERE deleted_at IS NULL AND entry_date BETWEEN ? AND ?
       GROUP BY kind, category_name
       ORDER BY total DESC`,
      [from, to]
    );
    const [allTimeRows] = await pool.query(
      `SELECT kind, SUM(amount) AS total FROM ledger_entries WHERE deleted_at IS NULL GROUP BY kind`
    );

    const byCategory = { received: [], expense: [] };
    const totals = { received: 0, expense: 0 };
    for (const r of rangeRows) {
      byCategory[r.kind].push({ category_name: r.category_name, total: Number(r.total), count: r.count });
      totals[r.kind] += Number(r.total);
    }
    const allTime = { received: 0, expense: 0 };
    for (const r of allTimeRows) allTime[r.kind] = Number(r.total);

    res.json({
      range: { from, to },
      totals: { received: totals.received, expense: totals.expense, net: totals.received - totals.expense },
      byCategory,
      allTime: { received: allTime.received, expense: allTime.expense, balance: allTime.received - allTime.expense },
    });
  } catch (e) { next(e); }
});

export default router;
