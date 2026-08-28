import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import publicRoutes from './routes/public.js';
import adminRoutes from './routes/admin.js';
import userRoutes from './routes/users.js';
import settingsRoutes from './routes/settings.js';
import formAdminRoutes from './routes/formadmin.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.use('/api', publicRoutes);
app.use('/api/admin/users', userRoutes);
app.use('/api/admin/settings', settingsRoutes);
app.use('/api/admin/form', formAdminRoutes);
app.use('/api/admin', adminRoutes);

app.use((err, req, res, next) => {
  if (err.name === 'MulterError') {
    return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'File too large (max 5 MB)' : err.message });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`REACH API running on http://localhost:${port}`));
