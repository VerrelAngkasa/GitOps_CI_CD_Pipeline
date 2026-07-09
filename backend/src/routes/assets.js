const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

function latestValueForAsset(assetId) {
  const row = db
    .prepare('SELECT value, date FROM asset_values WHERE asset_id = ? ORDER BY date DESC, id DESC LIMIT 1')
    .get(assetId);
  return row ? row.value : 0;
}

// List assets with their current (latest) value and share of total assets attached
router.get('/', (req, res) => {
  const includeArchived = req.query.includeArchived === 'true';
  let sql = 'SELECT * FROM assets WHERE user_id = ?';
  if (!includeArchived) sql += ' AND archived = 0';
  sql += ' ORDER BY type, name';

  const assets = db.prepare(sql).all(req.userId);
  const withValues = assets.map((a) => ({ ...a, currentValue: latestValueForAsset(a.id) }));

  // Percentage is of total *positive* value (liabilities shown as negative, excluded from the base)
  const totalPositive = withValues.reduce((s, a) => s + (a.currentValue > 0 ? a.currentValue : 0), 0);
  const withPercentage = withValues.map((a) => ({
    ...a,
    percentage: totalPositive > 0 && a.currentValue > 0 ? (a.currentValue / totalPositive) * 100 : 0,
  }));

  res.json(withPercentage);
});

router.post('/', (req, res) => {
  const { name, type, notes, initialValue, date } = req.body || {};
  if (!name || !type) {
    return res.status(400).json({ error: 'name and type are required.' });
  }

  const info = db
    .prepare('INSERT INTO assets (user_id, name, type, notes) VALUES (?, ?, ?, ?)')
    .run(req.userId, name, type, notes || null);

  const assetId = info.lastInsertRowid;

  if (initialValue !== undefined && initialValue !== null && initialValue !== '') {
    const val = Number(initialValue);
    if (!Number.isNaN(val)) {
      db.prepare('INSERT INTO asset_values (asset_id, date, value) VALUES (?, ?, ?)').run(
        assetId,
        date || new Date().toISOString().slice(0, 10),
        val
      );
    }
  }

  const row = db.prepare('SELECT * FROM assets WHERE id = ?').get(assetId);
  res.status(201).json({ ...row, currentValue: latestValueForAsset(assetId) });
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM assets WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!existing) return res.status(404).json({ error: 'Asset not found.' });

  const { name, type, notes, archived } = req.body || {};
  db.prepare('UPDATE assets SET name = ?, type = ?, notes = ?, archived = ? WHERE id = ?').run(
    name || existing.name,
    type || existing.type,
    notes !== undefined ? notes : existing.notes,
    archived !== undefined ? (archived ? 1 : 0) : existing.archived,
    req.params.id
  );

  const row = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
  res.json({ ...row, currentValue: latestValueForAsset(row.id) });
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM assets WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!existing) return res.status(404).json({ error: 'Asset not found.' });
  db.prepare('DELETE FROM assets WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// --- Value history for one asset ---

router.get('/:id/values', (req, res) => {
  const asset = db.prepare('SELECT * FROM assets WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!asset) return res.status(404).json({ error: 'Asset not found.' });

  const rows = db
    .prepare('SELECT * FROM asset_values WHERE asset_id = ? ORDER BY date ASC, id ASC')
    .all(req.params.id);
  res.json(rows);
});

router.post('/:id/values', (req, res) => {
  const asset = db.prepare('SELECT * FROM assets WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!asset) return res.status(404).json({ error: 'Asset not found.' });

  const { date, value } = req.body || {};
  const val = Number(value);
  if (!date || Number.isNaN(val)) {
    return res.status(400).json({ error: 'date and numeric value are required.' });
  }

  const info = db
    .prepare('INSERT INTO asset_values (asset_id, date, value) VALUES (?, ?, ?)')
    .run(req.params.id, date, val);

  const row = db.prepare('SELECT * FROM asset_values WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(row);
});

router.delete('/:id/values/:valueId', (req, res) => {
  const asset = db.prepare('SELECT * FROM assets WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!asset) return res.status(404).json({ error: 'Asset not found.' });

  const value = db
    .prepare('SELECT * FROM asset_values WHERE id = ? AND asset_id = ?')
    .get(req.params.valueId, req.params.id);
  if (!value) return res.status(404).json({ error: 'Value entry not found.' });

  db.prepare('DELETE FROM asset_values WHERE id = ?').run(req.params.valueId);
  res.json({ ok: true });
});

module.exports = router;
