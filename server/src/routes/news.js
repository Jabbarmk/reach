import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { pool } from '../db.js';
import { requireAdmin, requireScreen } from '../middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const NEWS_DIR = path.join(__dirname, '..', '..', 'uploads', 'news');
if (!fs.existsSync(NEWS_DIR)) fs.mkdirSync(NEWS_DIR, { recursive: true });

const router = express.Router();
router.use(requireAdmin, requireScreen('events'));

const upload = multer({
  storage: multer.diskStorage({
    destination: NEWS_DIR,
    filename: (req, file, cb) => {
      const ext = file.mimetype === 'image/png' ? '.png' : '.jpg';
      cb(null, `news_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`);
    },
  }),
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!['image/jpeg', 'image/png'].includes(file.mimetype)) return cb(new Error('Images must be a JPG or PNG'));
    cb(null, true);
  },
});
const uploadFields = upload.fields([{ name: 'image', maxCount: 1 }, { name: 'gallery', maxCount: 12 }]);

async function attachImages(rows) {
  if (!rows.length) return rows;
  const [images] = await pool.query(
    'SELECT id, news_item_id, image_mime FROM news_item_images WHERE news_item_id IN (?) ORDER BY sort_order, id',
    [rows.map((r) => r.id)]
  );
  const byItem = new Map();
  for (const img of images) {
    if (!byItem.has(img.news_item_id)) byItem.set(img.news_item_id, []);
    byItem.get(img.news_item_id).push({ id: img.id });
  }
  return rows.map((r) => ({ ...r, images: byItem.get(r.id) || [] }));
}

router.get('/', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM news_items ORDER BY published_on DESC, id DESC');
    res.json(await attachImages(rows));
  } catch (e) { next(e); }
});

router.post('/', uploadFields, async (req, res, next) => {
  try {
    const { tag, title, body, published_on, is_published, kind } = req.body || {};
    if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });
    if (!body?.trim()) return res.status(400).json({ error: 'Body text is required' });
    const coverFile = req.files?.image?.[0];
    const galleryFiles = req.files?.gallery || [];
    const [result] = await pool.query(
      'INSERT INTO news_items (kind, tag, title, body, image_file, image_mime, is_published, published_on) VALUES (?,?,?,?,?,?,?,?)',
      [
        kind === 'event' ? 'event' : 'news',
        tag?.trim() || 'Announcement', title.trim(), body.trim(),
        coverFile?.filename || null, coverFile?.mimetype || null,
        is_published === 'false' ? 0 : 1,
        published_on || new Date().toISOString().slice(0, 10),
      ]
    );
    for (let i = 0; i < galleryFiles.length; i++) {
      await pool.query(
        'INSERT INTO news_item_images (news_item_id, image_file, image_mime, sort_order) VALUES (?,?,?,?)',
        [result.insertId, galleryFiles[i].filename, galleryFiles[i].mimetype, i]
      );
    }
    const [rows] = await pool.query('SELECT * FROM news_items WHERE id = ?', [result.insertId]);
    res.json((await attachImages(rows))[0]);
  } catch (e) { next(e); }
});

router.put('/:id', uploadFields, async (req, res, next) => {
  try {
    const [existing] = await pool.query('SELECT * FROM news_items WHERE id = ?', [req.params.id]);
    if (!existing.length) return res.status(404).json({ error: 'News item not found' });
    const current = existing[0];
    const { tag, title, body, published_on, is_published, kind, remove_images: removeImagesRaw } = req.body || {};
    if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });
    if (!body?.trim()) return res.status(400).json({ error: 'Body text is required' });
    const coverFile = req.files?.image?.[0];
    const galleryFiles = req.files?.gallery || [];
    const imageFile = coverFile ? coverFile.filename : current.image_file;
    const imageMime = coverFile ? coverFile.mimetype : current.image_mime;
    await pool.query(
      'UPDATE news_items SET kind=?, tag=?, title=?, body=?, image_file=?, image_mime=?, is_published=?, published_on=? WHERE id=?',
      [
        kind === 'event' ? 'event' : 'news',
        tag?.trim() || 'Announcement', title.trim(), body.trim(), imageFile, imageMime,
        is_published === 'false' ? 0 : 1, published_on || current.published_on, req.params.id,
      ]
    );
    if (coverFile && current.image_file) {
      try { fs.unlinkSync(path.join(NEWS_DIR, path.basename(current.image_file))); } catch { /* already gone */ }
    }

    // Remove gallery images the admin explicitly deleted.
    let removeIds = [];
    try { removeIds = JSON.parse(removeImagesRaw || '[]'); } catch { removeIds = []; }
    if (Array.isArray(removeIds) && removeIds.length) {
      const [toRemove] = await pool.query('SELECT id, image_file FROM news_item_images WHERE id IN (?) AND news_item_id = ?', [removeIds, req.params.id]);
      for (const img of toRemove) {
        try { fs.unlinkSync(path.join(NEWS_DIR, path.basename(img.image_file))); } catch { /* already gone */ }
      }
      await pool.query('DELETE FROM news_item_images WHERE id IN (?) AND news_item_id = ?', [removeIds, req.params.id]);
    }

    // Append any newly-added gallery images after existing ones.
    if (galleryFiles.length) {
      const [[{ maxOrder }]] = await pool.query('SELECT COALESCE(MAX(sort_order), -1) AS maxOrder FROM news_item_images WHERE news_item_id = ?', [req.params.id]);
      for (let i = 0; i < galleryFiles.length; i++) {
        await pool.query(
          'INSERT INTO news_item_images (news_item_id, image_file, image_mime, sort_order) VALUES (?,?,?,?)',
          [req.params.id, galleryFiles[i].filename, galleryFiles[i].mimetype, maxOrder + 1 + i]
        );
      }
    }

    const [rows] = await pool.query('SELECT * FROM news_items WHERE id = ?', [req.params.id]);
    res.json((await attachImages(rows))[0]);
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const [existing] = await pool.query('SELECT * FROM news_items WHERE id = ?', [req.params.id]);
    if (!existing.length) return res.status(404).json({ error: 'News item not found' });
    const [galleryRows] = await pool.query('SELECT image_file FROM news_item_images WHERE news_item_id = ?', [req.params.id]);
    await pool.query('DELETE FROM news_items WHERE id = ?', [req.params.id]); // cascades news_item_images
    if (existing[0].image_file) {
      try { fs.unlinkSync(path.join(NEWS_DIR, path.basename(existing[0].image_file))); } catch { /* already gone */ }
    }
    for (const img of galleryRows) {
      try { fs.unlinkSync(path.join(NEWS_DIR, path.basename(img.image_file))); } catch { /* already gone */ }
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
