const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { adjustBalance } = require('../utils/pockets');

const router = express.Router();
router.use(requireAuth);

function ownsAsset(userId, assetId) {
  if (!assetId) return true;
  return !!db.prepare('SELECT id FROM assets WHERE id = ? AND user_id = ?').get(assetId, userId);
}

// List expenses, optionally filtered by from/to date and category
router.get('/', (req, res) => {
  const { from, to, category, assetId } = req.query;
  let sql = 'SELECT * FROM expenses WHERE user_id = ?';
  const params = [req.userId];

  if (from) {
    sql += ' AND date >= ?';
    params.push(from);
  }
  if (to) {
    sql += ' AND date <= ?';
    params.push(to);
  }
  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }
  if (assetId) {
    sql += ' AND asset_id = ?';
    params.push(assetId);
  }
  sql += ' ORDER BY date DESC, id DESC';

  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

router.post('/', (req, res) => {
  const { date, category, description, amount, assetId } = req.body || {};
  if (!date || !category || amount === undefined || amount === null) {
    return res.status(400).json({ error: 'date, category and amount are required.' });
  }
  const amt = Number(amount);
  if (Number.isNaN(amt) || amt < 0) {
    return res.status(400).json({ error: 'amount must be a non-negative number.' });
  }
  if (assetId && !ownsAsset(req.userId, assetId)) {
    return res.status(400).json({ error: 'Pocket not found.' });
  }

  const info = db
    .prepare('INSERT INTO expenses (user_id, asset_id, date, category, description, amount) VALUES (?, ?, ?, ?, ?, ?)')
    .run(req.userId, assetId || null, date, category, description || null, amt);

  if (assetId) adjustBalance(assetId, -amt, date);

  const row = db.prepare('SELECT * FROM expenses WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(row);
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM expenses WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!existing) return res.status(404).json({ error: 'Expense not found.' });

  const { date, category, description, amount, assetId } = req.body || {};
  const amt = amount !== undefined ? Number(amount) : existing.amount;
  if (Number.isNaN(amt) || amt < 0) {
    return res.status(400).json({ error: 'amount must be a non-negative number.' });
  }
  const nextAssetId = assetId !== undefined ? assetId || null : existing.asset_id;
  if (nextAssetId && !ownsAsset(req.userId, nextAssetId)) {
    return res.status(400).json({ error: 'Pocket not found.' });
  }
  const nextDate = date || existing.date;

  // Only touch pocket balances if something that actually affects them changed.
  // Writing a snapshot on every edit (even unrelated fields like description)
  // was creating noisy, misleading history entries.
  const amountChanged = amt !== existing.amount;
  const assetChanged = nextAssetId !== existing.asset_id;

  if (assetChanged) {
    // Moving between two different pockets (or into/out of "no pocket") —
    // these are genuinely two separate balances, so both need a write.
    if (existing.asset_id) adjustBalance(existing.asset_id, existing.amount, nextDate);
    if (nextAssetId) adjustBalance(nextAssetId, -amt, nextDate);
  } else if (nextAssetId && amountChanged) {
    // Same pocket throughout — apply the difference in a single write instead
    // of reversing the old amount and re-applying the new one as two writes.
    const delta = existing.amount - amt;
    if (delta !== 0) adjustBalance(nextAssetId, delta, nextDate);
  }

  db.prepare('UPDATE expenses SET date = ?, category = ?, description = ?, amount = ?, asset_id = ? WHERE id = ?').run(
    nextDate,
    category || existing.category,
    description !== undefined ? description : existing.description,
    amt,
    nextAssetId,
    req.params.id
  );

  const row = db.prepare('SELECT * FROM expenses WHERE id = ?').get(req.params.id);
  res.json(row);
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM expenses WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!existing) return res.status(404).json({ error: 'Expense not found.' });

  if (existing.asset_id) {
    adjustBalance(existing.asset_id, existing.amount, new Date().toISOString().slice(0, 10));
  }

  db.prepare('DELETE FROM expenses WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Distinct categories used so far, to power a suggestions list in the UI
router.get('/meta/categories', (req, res) => {
  const rows = db
    .prepare('SELECT DISTINCT category FROM expenses WHERE user_id = ? ORDER BY category')
    .all(req.userId);
  res.json(rows.map((r) => r.category));
});

module.exports = router;
