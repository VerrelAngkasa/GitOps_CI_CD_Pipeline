const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { adjustBalance } = require('../utils/pockets');

const router = express.Router();
router.use(requireAuth);

function ownsAsset(userId, assetId) {
  return !!db.prepare('SELECT id FROM assets WHERE id = ? AND user_id = ?').get(assetId, userId);
}

router.get('/', (req, res) => {
  const { from, to, assetId } = req.query;
  let sql = 'SELECT * FROM income_entries WHERE user_id = ?';
  const params = [req.userId];
  if (from) {
    sql += ' AND date >= ?';
    params.push(from);
  }
  if (to) {
    sql += ' AND date <= ?';
    params.push(to);
  }
  if (assetId) {
    sql += ' AND asset_id = ?';
    params.push(assetId);
  }
  sql += ' ORDER BY date DESC, id DESC';
  res.json(db.prepare(sql).all(...params));
});

router.post('/', (req, res) => {
  const { date, assetId, source, description, amount } = req.body || {};
  if (!date || !assetId || !source || amount === undefined) {
    return res.status(400).json({ error: 'date, assetId, source and amount are required.' });
  }
  const amt = Number(amount);
  if (Number.isNaN(amt) || amt <= 0) {
    return res.status(400).json({ error: 'amount must be a positive number.' });
  }
  if (!ownsAsset(req.userId, assetId)) {
    return res.status(400).json({ error: 'Pocket not found.' });
  }

  const info = db
    .prepare('INSERT INTO income_entries (user_id, asset_id, date, source, description, amount) VALUES (?, ?, ?, ?, ?, ?)')
    .run(req.userId, assetId, date, source, description || null, amt);

  adjustBalance(assetId, amt, date);

  const row = db.prepare('SELECT * FROM income_entries WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(row);
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM income_entries WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!existing) return res.status(404).json({ error: 'Income entry not found.' });

  adjustBalance(existing.asset_id, -existing.amount, new Date().toISOString().slice(0, 10));
  db.prepare('DELETE FROM income_entries WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.get('/meta/sources', (req, res) => {
  const rows = db
    .prepare('SELECT DISTINCT source FROM income_entries WHERE user_id = ? ORDER BY source')
    .all(req.userId);
  res.json(rows.map((r) => r.source));
});

module.exports = router;
