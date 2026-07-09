const db = require('../db');

// Latest known balance for a pocket, i.e. the most recent asset_values row.
function currentBalance(assetId) {
  const row = db
    .prepare('SELECT value FROM asset_values WHERE asset_id = ? ORDER BY date DESC, id DESC LIMIT 1')
    .get(assetId);
  return row ? row.value : 0;
}

// Applies a delta (positive or negative) to a pocket's balance by writing a new
// snapshot dated on `date`. This always adjusts from the latest known balance,
// so backdated entries nudge the current total rather than rewriting history.
function adjustBalance(assetId, delta, date) {
  const next = currentBalance(assetId) + delta;
  db.prepare('INSERT INTO asset_values (asset_id, date, value) VALUES (?, ?, ?)').run(assetId, date, next);
  return next;
}

module.exports = { currentBalance, adjustBalance };
