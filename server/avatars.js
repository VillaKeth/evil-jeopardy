const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { upsertPlayerProfile } = require('./db');

const router = express.Router();
const AVATAR_DIR = path.join(__dirname, '..', 'data', 'avatars');

if (!fs.existsSync(AVATAR_DIR)) fs.mkdirSync(AVATAR_DIR, { recursive: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  }
});

router.post('/api/avatar', upload.single('image'), async (req, res) => {
  try {
    const name = req.body.name;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const safeName = name.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
    const filename = `${safeName}.webp`;
    const filepath = path.join(AVATAR_DIR, filename);

    await sharp(req.file.buffer)
      .resize(128, 128, { fit: 'cover' })
      .webp({ quality: 80 })
      .toFile(filepath);

    const avatarUrl = `/avatars/${filename}`;
    upsertPlayerProfile(name.trim(), avatarUrl);

    res.json({ avatar: avatarUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
