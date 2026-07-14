const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { monthBounds, shiftMonth, todayISO } = require('../utils/dates');

const router = express.Router();
router.use(requireAuth);

// Net worth as of a given date = sum of each asset's latest value snapshot on/before that date.
function netWorthAsOf(userId, date) {
  const assets = db.prepare('SELECT id FROM assets WHERE user_id = ?').all(userId);
  let total = 0;
  const breakdown = [];
  for (const a of assets) {
    const row = db
      .prepare(
        'SELECT value FROM asset_values WHERE asset_id = ? AND date <= ? ORDER BY date DESC, id DESC LIMIT 1'
      )
      .get(a.id, date);
    if (row) {
      total += row.value;
      breakdown.push({ assetId: a.id, value: row.value });
    }
  }
  return { total, breakdown };
}

function fixedExpensesForMonth(userId, monthStart, monthEnd) {
  return db
    .prepare(
      `SELECT * FROM fixed_expenses
       WHERE user_id = ? AND active = 1
         AND start_date <= ?
         AND (end_date IS NULL OR end_date >= ?)`
    )
    .all(userId, monthEnd, monthStart);
}

// The quota set for this exact month, or the most recent earlier one carried forward.
function resolveQuota(userId, year, month) {
  const row = db
    .prepare(
      `SELECT * FROM spending_quotas
       WHERE user_id = ? AND (year < ? OR (year = ? AND month <= ?))
       ORDER BY year DESC, month DESC LIMIT 1`
    )
    .get(userId, year, year, month);
  if (!row) return null;
  return {
    amount: row.amount,
    assetId: row.asset_id || null,
    isExact: row.year === year && row.month === month,
    setFor: { year: row.year, month: row.month },
  };
}

router.get('/monthly', (req, res) => {
  const year = Number(req.query.year) || Number(todayISO().slice(0, 4));
  const month = Number(req.query.month) || Number(todayISO().slice(5, 7));
  const { start, end } = monthBounds(year, month);

  const dailyExpenses = db
    .prepare('SELECT * FROM expenses WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date')
    .all(req.userId, start, end);

  const income = db
    .prepare('SELECT * FROM income_entries WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date')
    .all(req.userId, start, end);

  const fixed = fixedExpensesForMonth(req.userId, start, end);

  const totalDaily = dailyExpenses.reduce((s, e) => s + e.amount, 0);
  const totalFixed = fixed.reduce((s, e) => s + e.amount, 0);
  const totalIncome = income.reduce((s, e) => s + e.amount, 0);

  const byCategoryMap = {};
  for (const e of dailyExpenses) {
    byCategoryMap[e.category] = (byCategoryMap[e.category] || 0) + e.amount;
  }
  for (const f of fixed) {
    byCategoryMap[f.category] = (byCategoryMap[f.category] || 0) + f.amount;
  }
  const byCategory = Object.entries(byCategoryMap)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  const currentNetWorth = netWorthAsOf(req.userId, end).total;
  const prev = shiftMonth(year, month, -1);
  const prevBounds = monthBounds(prev.year, prev.month);
  const previousNetWorth = netWorthAsOf(req.userId, prevBounds.end).total;

  const assets = db.prepare('SELECT * FROM assets WHERE user_id = ? AND archived = 0').all(req.userId);
  const assetBreakdown = assets.map((a) => {
    const row = db
      .prepare('SELECT value FROM asset_values WHERE asset_id = ? AND date <= ? ORDER BY date DESC, id DESC LIMIT 1')
      .get(a.id, end);
    return { id: a.id, name: a.name, type: a.type, value: row ? row.value : 0 };
  });
  const totalPositive = assetBreakdown.reduce((s, a) => s + (a.value > 0 ? a.value : 0), 0);
  const assetBreakdownWithPct = assetBreakdown.map((a) => ({
    ...a,
    percentage: totalPositive > 0 && a.value > 0 ? (a.value / totalPositive) * 100 : 0,
  }));

  const quota = resolveQuota(req.userId, year, month);
  let quotaBlock = null;
  if (quota) {
    const quotaSpent = quota.assetId
      ? dailyExpenses.filter((e) => e.asset_id === quota.assetId).reduce((s, e) => s + e.amount, 0)
      : totalDaily;
    const quotaAsset = quota.assetId ? db.prepare('SELECT id, name FROM assets WHERE id = ?').get(quota.assetId) : null;
    quotaBlock = {
      amount: quota.amount,
      isExact: quota.isExact,
      setFor: quota.setFor,
      assetId: quota.assetId,
      assetName: quotaAsset ? quotaAsset.name : null,
      spent: quotaSpent,
      left: quota.amount - quotaSpent,
    };
  }

  res.json({
    year,
    month,
    range: { start, end },
    dailyExpenses,
    fixedExpenses: fixed,
    income,
    totals: {
      daily: totalDaily,
      fixed: totalFixed,
      combined: totalDaily + totalFixed,
      income: totalIncome,
      net: totalIncome - (totalDaily + totalFixed),
    },
    byCategory,
    netWorth: {
      current: currentNetWorth,
      previous: previousNetWorth,
      change: currentNetWorth - previousNetWorth,
    },
    assetBreakdown: assetBreakdownWithPct,
    quota: quotaBlock,
  });
});

// Net worth trend for the last N months (default 12), one point per month-end.
router.get('/networth-history', (req, res) => {
  const months = Math.min(60, Math.max(1, Number(req.query.months) || 12));
  const now = new Date();
  const points = [];

  for (let i = months - 1; i >= 0; i--) {
    const total = now.getUTCFullYear() * 12 + now.getUTCMonth() - i;
    const year = Math.floor(total / 12);
    const month = (total % 12) + 1;
    const { end } = monthBounds(year, month);
    const { total: netWorth } = netWorthAsOf(req.userId, end);
    points.push({ year, month, date: end, netWorth });
  }

  res.json(points);
});

// Quick dashboard summary
router.get('/summary', (req, res) => {
  const today = todayISO();
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const { start, end } = monthBounds(year, month);

  const { total: netWorth, breakdown } = netWorthAsOf(req.userId, end);

  const assets = db.prepare('SELECT * FROM assets WHERE user_id = ? AND archived = 0').all(req.userId);
  let totalAssets = 0;
  let totalLiabilities = 0;
  for (const b of breakdown) {
    if (b.value >= 0) totalAssets += b.value;
    else totalLiabilities += Math.abs(b.value);
  }

  const monthToDateExpenses = db
    .prepare('SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE user_id = ? AND date >= ? AND date <= ?')
    .get(req.userId, start, today).total;

  const monthToDateIncome = db
    .prepare('SELECT COALESCE(SUM(amount),0) as total FROM income_entries WHERE user_id = ? AND date >= ? AND date <= ?')
    .get(req.userId, start, today).total;

  const fixed = fixedExpensesForMonth(req.userId, start, end);
  const totalFixed = fixed.reduce((s, e) => s + e.amount, 0);

  const prev = shiftMonth(year, month, -1);
  const prevBounds = monthBounds(prev.year, prev.month);
  const previousNetWorth = netWorthAsOf(req.userId, prevBounds.end).total;

  res.json({
    netWorth,
    totalAssets,
    totalLiabilities,
    assetCount: assets.length,
    monthToDateExpenses,
    monthToDateIncome,
    monthFixedExpenses: totalFixed,
    netWorthChange: netWorth - previousNetWorth,
  });
});

// Get or set the spending quota for a specific month
router.get('/quota', (req, res) => {
  const year = Number(req.query.year) || Number(todayISO().slice(0, 4));
  const month = Number(req.query.month) || Number(todayISO().slice(5, 7));
  const quota = resolveQuota(req.userId, year, month);
  res.json(quota || { amount: null, assetId: null, isExact: false, setFor: null, left: null });
});

router.put('/quota', (req, res) => {
  const { year, month, amount, assetId } = req.body || {};
  if (!year || !month || amount === undefined) {
    return res.status(400).json({ error: 'year, month and amount are required.' });
  }
  const amt = Number(amount);
  if (Number.isNaN(amt) || amt < 0) {
    return res.status(400).json({ error: 'amount must be a non-negative number.' });
  }
  const resolvedAssetId = assetId || null;
  if (resolvedAssetId && !db.prepare('SELECT id FROM assets WHERE id = ? AND user_id = ?').get(resolvedAssetId, req.userId)) {
    return res.status(400).json({ error: 'Pocket not found.' });
  }

  db.prepare(
    `INSERT INTO spending_quotas (user_id, year, month, amount, asset_id) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, year, month) DO UPDATE SET amount = excluded.amount, asset_id = excluded.asset_id`
  ).run(req.userId, year, month, amt, resolvedAssetId);

  res.json({ year, month, amount: amt, assetId: resolvedAssetId });
});

module.exports = router;
