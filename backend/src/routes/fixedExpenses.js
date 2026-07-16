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

router.get('/', (req, res) => {
  const rows = db
    .prepare('SELECT * FROM fixed_expenses WHERE user_id = ? ORDER BY active DESC, day_of_month ASC')
    .all(req.userId);
  res.json(rows);
});

router.post('/', (req, res) => {
  const { name, category, amount, dayOfMonth, startDate, endDate, assetId } = req.body || {};
  if (!name || !category || amount === undefined || !startDate) {
    return res.status(400).json({ error: 'name, category, amount and startDate are required.' });
  }
  const amt = Number(amount);
  if (Number.isNaN(amt) || amt < 0) {
    return res.status(400).json({ error: 'amount must be a non-negative number.' });
  }
  if (assetId && !ownsAsset(req.userId, assetId)) {
    return res.status(400).json({ error: 'Pocket not found.' });
  }
  const dom = dayOfMonth ? Math.min(28, Math.max(1, Number(dayOfMonth))) : 1;

  const info = db
    .prepare(
      `INSERT INTO fixed_expenses (user_id, asset_id, name, category, amount, day_of_month, start_date, end_date, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`
    )
    .run(req.userId, assetId || null, name, category, amt, dom, startDate, endDate || null);

  const row = db.prepare('SELECT * FROM fixed_expenses WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(row);
});

router.put('/:id', (req, res) => {
  const existing = db
    .prepare('SELECT * FROM fixed_expenses WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.userId);
  if (!existing) return res.status(404).json({ error: 'Fixed expense not found.' });

  const { name, category, amount, dayOfMonth, startDate, endDate, active, assetId } = req.body || {};
  const amt = amount !== undefined ? Number(amount) : existing.amount;
  if (Number.isNaN(amt) || amt < 0) {
    return res.status(400).json({ error: 'amount must be a non-negative number.' });
  }
  const nextAssetId = assetId !== undefined ? assetId || null : existing.asset_id;
  if (nextAssetId && !ownsAsset(req.userId, nextAssetId)) {
    return res.status(400).json({ error: 'Pocket not found.' });
  }

  db.prepare(
    `UPDATE fixed_expenses
     SET name = ?, category = ?, amount = ?, day_of_month = ?, start_date = ?, end_date = ?, active = ?, asset_id = ?
     WHERE id = ?`
  ).run(
    name || existing.name,
    category || existing.category,
    amt,
    dayOfMonth ? Math.min(28, Math.max(1, Number(dayOfMonth))) : existing.day_of_month,
    startDate || existing.start_date,
    endDate !== undefined ? endDate : existing.end_date,
    active !== undefined ? (active ? 1 : 0) : existing.active,
    nextAssetId,
    req.params.id
  );

  const row = db.prepare('SELECT * FROM fixed_expenses WHERE id = ?').get(req.params.id);
  res.json(row);
});

router.delete('/:id', (req, res) => {
  const existing = db
    .prepare('SELECT * FROM fixed_expenses WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.userId);
  if (!existing) return res.status(404).json({ error: 'Fixed expense not found.' });
  db.prepare('DELETE FROM fixed_expenses WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// --- Marking a specific month's occurrence as actually paid ---
// This deducts a pocket's balance the same way a daily expense would, but
// stays completely separate from the spending quota, which only ever looks
// at the `expenses` (Daily Expenses) table.

router.post('/:id/pay', (req, res) => {
  const fixedExpense = db
    .prepare('SELECT * FROM fixed_expenses WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.userId);
  if (!fixedExpense) return res.status(404).json({ error: 'Fixed expense not found.' });

  const { year, month, date, assetId, amount } = req.body || {};
  if (!year || !month || !date) {
    return res.status(400).json({ error: 'year, month and date are required.' });
  }
  const resolvedAssetId = assetId || fixedExpense.asset_id;
  if (!resolvedAssetId) {
    return res.status(400).json({ error: 'Choose a pocket to pay this from.' });
  }
  if (!ownsAsset(req.userId, resolvedAssetId)) {
    return res.status(400).json({ error: 'Pocket not found.' });
  }
  const amt = amount !== undefined ? Number(amount) : fixedExpense.amount;
  if (Number.isNaN(amt) || amt < 0) {
    return res.status(400).json({ error: 'amount must be a non-negative number.' });
  }

  const already = db
    .prepare('SELECT id FROM fixed_expense_payments WHERE fixed_expense_id = ? AND year = ? AND month = ?')
    .get(req.params.id, year, month);
  if (already) {
    return res.status(409).json({ error: 'This month is already marked as paid. Undo it first to change it.' });
  }

  const info = db
    .prepare(
      `INSERT INTO fixed_expense_payments (user_id, fixed_expense_id, asset_id, year, month, date, amount)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(req.userId, req.params.id, resolvedAssetId, year, month, date, amt);

  adjustBalance(resolvedAssetId, -amt, date);

  const row = db.prepare('SELECT * FROM fixed_expense_payments WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(row);
});

router.delete('/:id/pay/:paymentId', (req, res) => {
  const payment = db
    .prepare('SELECT * FROM fixed_expense_payments WHERE id = ? AND fixed_expense_id = ? AND user_id = ?')
    .get(req.params.paymentId, req.params.id, req.userId);
  if (!payment) return res.status(404).json({ error: 'Payment record not found.' });

  adjustBalance(payment.asset_id, payment.amount, new Date().toISOString().slice(0, 10));
  db.prepare('DELETE FROM fixed_expense_payments WHERE id = ?').run(req.params.paymentId);
  res.json({ ok: true });
});

module.exports = router;
