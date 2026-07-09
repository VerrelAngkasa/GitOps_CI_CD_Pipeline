const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const rows = db
    .prepare('SELECT * FROM fixed_expenses WHERE user_id = ? ORDER BY active DESC, day_of_month ASC')
    .all(req.userId);
  res.json(rows);
});

router.post('/', (req, res) => {
  const { name, category, amount, dayOfMonth, startDate, endDate } = req.body || {};
  if (!name || !category || amount === undefined || !startDate) {
    return res.status(400).json({ error: 'name, category, amount and startDate are required.' });
  }
  const amt = Number(amount);
  if (Number.isNaN(amt) || amt < 0) {
    return res.status(400).json({ error: 'amount must be a non-negative number.' });
  }
  const dom = dayOfMonth ? Math.min(28, Math.max(1, Number(dayOfMonth))) : 1;

  const info = db
    .prepare(
      `INSERT INTO fixed_expenses (user_id, name, category, amount, day_of_month, start_date, end_date, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`
    )
    .run(req.userId, name, category, amt, dom, startDate, endDate || null);

  const row = db.prepare('SELECT * FROM fixed_expenses WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(row);
});

router.put('/:id', (req, res) => {
  const existing = db
    .prepare('SELECT * FROM fixed_expenses WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.userId);
  if (!existing) return res.status(404).json({ error: 'Fixed expense not found.' });

  const { name, category, amount, dayOfMonth, startDate, endDate, active } = req.body || {};
  const amt = amount !== undefined ? Number(amount) : existing.amount;
  if (Number.isNaN(amt) || amt < 0) {
    return res.status(400).json({ error: 'amount must be a non-negative number.' });
  }

  db.prepare(
    `UPDATE fixed_expenses
     SET name = ?, category = ?, amount = ?, day_of_month = ?, start_date = ?, end_date = ?, active = ?
     WHERE id = ?`
  ).run(
    name || existing.name,
    category || existing.category,
    amt,
    dayOfMonth ? Math.min(28, Math.max(1, Number(dayOfMonth))) : existing.day_of_month,
    startDate || existing.start_date,
    endDate !== undefined ? endDate : existing.end_date,
    active !== undefined ? (active ? 1 : 0) : existing.active,
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

module.exports = router;
