// All dates are handled as plain YYYY-MM-DD strings to avoid timezone drift.

function monthBounds(year, month) {
  // month is 1-12
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { start, end, lastDay };
}

function shiftMonth(year, month, delta) {
  const total = year * 12 + (month - 1) + delta;
  const newYear = Math.floor(total / 12);
  const newMonth = (total % 12) + 1;
  return { year: newYear, month: newMonth };
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

module.exports = { monthBounds, shiftMonth, todayISO };
