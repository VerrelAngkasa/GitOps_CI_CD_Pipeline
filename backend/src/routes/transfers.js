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
  const { from, to } = req.query;
  let sql = 'SELECT * FROM transfers WHERE user_id = ?';
  const params = [req.userId];
  if (from) {
    sql += ' AND date >= ?';
    params.push(from);
  }
  if (to) {
    sql += ' AND date <= ?';
    params.push(to);
  }
  sql += ' ORDER BY date DESC, id DESC';
  res.json(db.prepare(sql).all(...params));
});

router.post('/', (req, res) => {
  const { date, fromAssetId, toAssetId, description, amount } = req.body || {};
  if (!date || !fromAssetId || !toAssetId || amount === undefined) {
    return res.status(400).json({ error: 'date, fromAssetId, toAssetId and amount are required.' });
  }
  if (fromAssetId === toAssetId) {
    return res.status(400).json({ error: 'Choose two different pockets.' });
  }
  const amt = Number(amount);
  if (Number.isNaN(amt) || amt <= 0) {
    return res.status(400).json({ error: 'amount must be a positive number.' });
  }
  if (!ownsAsset(req.userId, fromAssetId) || !ownsAsset(req.userId, toAssetId)) {
    return res.status(400).json({ error: 'Pocket not found.' });
  }

  const info = db
    .prepare(
      'INSERT INTO transfers (user_id, from_asset_id, to_asset_id, date, description, amount) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(req.userId, fromAssetId, toAssetId, date, description || null, amt);

  adjustBalance(fromAssetId, -amt, date);
  adjustBalance(toAssetId, amt, date);

  const row = db.prepare('SELECT * FROM transfers WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(row);
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM transfers WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!existing) return res.status(404).json({ error: 'Transfer not found.' });

  const today = new Date().toISOString().slice(0, 10);
  adjustBalance(existing.from_asset_id, existing.amount, today);
  adjustBalance(existing.to_asset_id, -existing.amount, today);

  db.prepare('DELETE FROM transfers WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
