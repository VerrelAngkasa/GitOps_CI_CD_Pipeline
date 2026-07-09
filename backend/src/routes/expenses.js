const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// List expenses, optionally filtered by from/to date and category
router.get('/', (req, res) => {
  const { from, to, category } = req.query;
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
  sql += ' ORDER BY date DESC, id DESC';

  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

router.post('/', (req, res) => {
  const { date, category, description, amount } = req.body || {};
  if (!date || !category || amount === undefined || amount === null) {
    return res.status(400).json({ error: 'date, category and amount are required.' });
  }
  const amt = Number(amount);
  if (Number.isNaN(amt) || amt < 0) {
    return res.status(400).json({ error: 'amount must be a non-negative number.' });
  }

  const info = db
    .prepare('INSERT INTO expenses (user_id, date, category, description, amount) VALUES (?, ?, ?, ?, ?)')
    .run(req.userId, date, category, description || null, amt);

  const row = db.prepare('SELECT * FROM expenses WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(row);
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM expenses WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!existing) return res.status(404).json({ error: 'Expense not found.' });

  const { date, category, description, amount } = req.body || {};
  const amt = amount !== undefined ? Number(amount) : existing.amount;
  if (Number.isNaN(amt) || amt < 0) {
    return res.status(400).json({ error: 'amount must be a non-negative number.' });
  }

  db.prepare('UPDATE expenses SET date = ?, category = ?, description = ?, amount = ? WHERE id = ?').run(
    date || existing.date,
    category || existing.category,
    description !== undefined ? description : existing.description,
    amt,
    req.params.id
  );

  const row = db.prepare('SELECT * FROM expenses WHERE id = ?').get(req.params.id);
  res.json(row);
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM expenses WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!existing) return res.status(404).json({ error: 'Expense not found.' });
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
