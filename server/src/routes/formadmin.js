import express from 'express';
import { pool } from '../db.js';
import { requireAdmin, requireScreen } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAdmin, requireScreen('form'));

const FIELD_TYPES = ['text', 'number', 'date', 'select', 'yesno'];
const STEPS = ['personal', 'expat', 'retired', 'details'];

/* ===== Fields ===== */
router.get('/fields', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM form_fields ORDER BY step, sort_order, id');
    res.json({ fields: rows });
  } catch (e) { next(e); }
});

router.post('/fields', async (req, res, next) => {
  try {
    const { step, label, field_type, required, options_key } = req.body || {};
    if (!STEPS.includes(step)) return res.status(400).json({ error: 'Invalid step' });
    if (!label?.trim()) return res.status(400).json({ error: 'Label is required' });
    if (!FIELD_TYPES.includes(field_type)) return res.status(400).json({ error: 'Invalid field type' });
    if (field_type === 'select' && !options_key?.trim()) return res.status(400).json({ error: 'A dropdown needs an option list' });

    const key = 'custom_' + label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) + '_' + Date.now().toString(36);
    const [[{ maxSort }]] = await pool.query('SELECT COALESCE(MAX(sort_order),0) AS maxSort FROM form_fields WHERE step = ?', [step]);
    const [result] = await pool.query(
      'INSERT INTO form_fields (field_key, step, label, field_type, required, visible, is_core, options_key, sort_order) VALUES (?,?,?,?,?,1,0,?,?)',
      [key, step, label.trim(), field_type, required ? 1 : 0, field_type === 'select' ? options_key.trim() : null, maxSort + 10]
    );
    const [rows] = await pool.query('SELECT * FROM form_fields WHERE id = ?', [result.insertId]);
    res.status(201).json({ field: rows[0] });
  } catch (e) { next(e); }
});

router.put('/fields/:id', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM form_fields WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Field not found' });
    const f = rows[0];
    const { label, required, visible, options_key, field_type } = req.body || {};

    const updates = {
      label: label !== undefined && label.trim() ? label.trim() : f.label,
      required: required !== undefined ? (required ? 1 : 0) : f.required,
      visible: visible !== undefined ? (visible ? 1 : 0) : f.visible,
    };
    if (!f.is_core) {
      if (field_type !== undefined) {
        if (!FIELD_TYPES.includes(field_type)) return res.status(400).json({ error: 'Invalid field type' });
        updates.field_type = field_type;
      }
      if (options_key !== undefined) updates.options_key = options_key?.trim() || null;
    }
    // Core fields cannot be hidden if required; required core fields stay visible.
    if (updates.required && !updates.visible) updates.visible = 1;

    const keys = Object.keys(updates);
    await pool.query(`UPDATE form_fields SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`, [...Object.values(updates), f.id]);
    const [fresh] = await pool.query('SELECT * FROM form_fields WHERE id = ?', [f.id]);
    res.json({ field: fresh[0] });
  } catch (e) { next(e); }
});

router.post('/fields/:id/move', async (req, res, next) => {
  try {
    const { direction } = req.body || {};
    const [rows] = await pool.query('SELECT * FROM form_fields WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Field not found' });
    const f = rows[0];
    const op = direction === 'up' ? '<' : '>';
    const order = direction === 'up' ? 'DESC' : 'ASC';
    const [neigh] = await pool.query(
      `SELECT * FROM form_fields WHERE step = ? AND sort_order ${op} ? ORDER BY sort_order ${order} LIMIT 1`,
      [f.step, f.sort_order]
    );
    if (neigh.length) {
      const n = neigh[0];
      await pool.query('UPDATE form_fields SET sort_order = ? WHERE id = ?', [n.sort_order, f.id]);
      await pool.query('UPDATE form_fields SET sort_order = ? WHERE id = ?', [f.sort_order, n.id]);
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/fields/:id', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM form_fields WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Field not found' });
    if (rows[0].is_core) return res.status(400).json({ error: 'Core fields cannot be deleted — hide them instead' });
    await pool.query('DELETE FROM form_fields WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/* ===== Option lists ===== */
router.get('/options', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM option_lists ORDER BY list_key, sort_order, id');
    const [custom] = await pool.query("SELECT DISTINCT options_key FROM form_fields WHERE options_key IS NOT NULL");
    res.json({ options: rows, listKeys: [...new Set(custom.map((r) => r.options_key))] });
  } catch (e) { next(e); }
});

router.post('/options', async (req, res, next) => {
  try {
    const { list_key, value } = req.body || {};
    if (!list_key?.trim() || !value?.trim()) return res.status(400).json({ error: 'List and value are required' });
    const [[{ maxSort }]] = await pool.query('SELECT COALESCE(MAX(sort_order),0) AS maxSort FROM option_lists WHERE list_key = ?', [list_key.trim()]);
    try {
      const [result] = await pool.query(
        'INSERT INTO option_lists (list_key, value, sort_order) VALUES (?,?,?)',
        [list_key.trim(), value.trim(), maxSort + 1]
      );
      res.status(201).json({ option: { id: result.insertId, list_key: list_key.trim(), value: value.trim(), sort_order: maxSort + 1 } });
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'This option already exists in the list' });
      throw e;
    }
  } catch (e) { next(e); }
});

router.put('/options/:id', async (req, res, next) => {
  try {
    const { value } = req.body || {};
    if (!value?.trim()) return res.status(400).json({ error: 'Value is required' });
    try {
      await pool.query('UPDATE option_lists SET value = ? WHERE id = ?', [value.trim(), req.params.id]);
      res.json({ ok: true });
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'This option already exists in the list' });
      throw e;
    }
  } catch (e) { next(e); }
});

router.delete('/options/:id', async (req, res, next) => {
  try {
    await pool.query('DELETE FROM option_lists WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/* ===== Membership plans ===== */
router.get('/plans', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM membership_plans ORDER BY sort_order, id');
    res.json({ plans: rows });
  } catch (e) { next(e); }
});

function validatePlan(body) {
  const { name, fee, validity_type, validity_start, validity_end } = body || {};
  if (!name?.trim()) return 'Plan name is required';
  if (!(Number(fee) >= 0)) return 'Fee must be 0 or more';
  if (!['range', 'lifetime'].includes(validity_type)) return 'Validity type is invalid';
  if (validity_type === 'range' && (!validity_start || !validity_end)) return 'Start and end dates are required for a date-range plan';
  return null;
}

router.post('/plans', async (req, res, next) => {
  try {
    const err = validatePlan(req.body);
    if (err) return res.status(400).json({ error: err });
    const { name, fee, validity_type, validity_start, validity_end, is_active } = req.body;
    const code = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 25) + '_' + Date.now().toString(36).slice(-4);
    const [[{ maxSort }]] = await pool.query('SELECT COALESCE(MAX(sort_order),0) AS maxSort FROM membership_plans');
    const [result] = await pool.query(
      'INSERT INTO membership_plans (code, name, fee, validity_type, validity_start, validity_end, is_active, sort_order) VALUES (?,?,?,?,?,?,?,?)',
      [code, name.trim(), Number(fee), validity_type,
       validity_type === 'range' ? validity_start : null,
       validity_type === 'range' ? validity_end : null,
       is_active === false ? 0 : 1, maxSort + 1]
    );
    const [rows] = await pool.query('SELECT * FROM membership_plans WHERE id = ?', [result.insertId]);
    res.status(201).json({ plan: rows[0] });
  } catch (e) { next(e); }
});

router.put('/plans/:id', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM membership_plans WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Plan not found' });
    const err = validatePlan({ ...rows[0], ...req.body });
    if (err) return res.status(400).json({ error: err });
    const p = rows[0];
    const b = req.body || {};
    const validity_type = b.validity_type ?? p.validity_type;
    await pool.query(
      'UPDATE membership_plans SET name = ?, fee = ?, validity_type = ?, validity_start = ?, validity_end = ?, is_active = ? WHERE id = ?',
      [
        (b.name ?? p.name).trim(), Number(b.fee ?? p.fee), validity_type,
        validity_type === 'range' ? (b.validity_start ?? p.validity_start) : null,
        validity_type === 'range' ? (b.validity_end ?? p.validity_end) : null,
        b.is_active === undefined ? p.is_active : (b.is_active ? 1 : 0),
        p.id,
      ]
    );
    const [fresh] = await pool.query('SELECT * FROM membership_plans WHERE id = ?', [p.id]);
    res.json({ plan: fresh[0] });
  } catch (e) { next(e); }
});

router.delete('/plans/:id', async (req, res, next) => {
  try {
    const [[{ used }]] = await pool.query(
      'SELECT COUNT(*) AS used FROM applications a JOIN membership_plans p ON a.membership_type = p.code WHERE p.id = ?',
      [req.params.id]
    );
    if (used > 0) return res.status(400).json({ error: `This plan is used by ${used} application(s) — disable it instead of deleting` });
    const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM membership_plans WHERE is_active = 1');
    const [rows] = await pool.query('SELECT is_active FROM membership_plans WHERE id = ?', [req.params.id]);
    if (rows.length && rows[0].is_active && total <= 1) return res.status(400).json({ error: 'At least one active plan must remain' });
    await pool.query('DELETE FROM membership_plans WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
