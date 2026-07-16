const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'networth.sqlite');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  recovery_code_hash TEXT,
  display_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One-off / daily expenses (groceries, coffee, gas, etc.)
-- asset_id, when set, is the pocket the money actually came out of —
-- adding/editing/deleting an expense with a pocket adjusts that pocket's balance.
CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  asset_id INTEGER REFERENCES assets(id) ON DELETE SET NULL,
  date TEXT NOT NULL,              -- YYYY-MM-DD
  category TEXT NOT NULL,
  description TEXT,
  amount REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Fixed monthly expenses (rent, subscriptions, insurance...)
-- asset_id is the pocket this bill is usually paid from — used as the
-- default when marking a specific month's occurrence as paid.
CREATE TABLE IF NOT EXISTS fixed_expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  asset_id INTEGER REFERENCES assets(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  amount REAL NOT NULL,
  day_of_month INTEGER NOT NULL DEFAULT 1, -- billing day, 1-28
  active INTEGER NOT NULL DEFAULT 1,
  start_date TEXT NOT NULL,         -- YYYY-MM-DD, first month it applies
  end_date TEXT,                    -- YYYY-MM-DD or NULL if ongoing
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Records that a specific month's occurrence of a fixed expense was actually
-- paid out of a pocket. Creating one deducts the pocket's balance; deleting
-- one adds it back. One row per (fixed_expense, year, month).
CREATE TABLE IF NOT EXISTS fixed_expense_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fixed_expense_id INTEGER NOT NULL REFERENCES fixed_expenses(id) ON DELETE CASCADE,
  asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  date TEXT NOT NULL,
  amount REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(fixed_expense_id, year, month)
);

-- Assets / pockets (cash, bank, investments, property, vehicle, etc.)
CREATE TABLE IF NOT EXISTS assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,               -- cash, bank, investment, property, vehicle, crypto, other
  notes TEXT,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Point-in-time value snapshots for an asset (also used for liabilities: negative amount).
-- Every income entry, expense against a pocket, or transfer writes a new row here so the
-- pocket's "current balance" is always the latest snapshot.
CREATE TABLE IF NOT EXISTS asset_values (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  date TEXT NOT NULL,               -- YYYY-MM-DD
  value REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Income landing in a specific pocket (salary, transfer in, gift, interest...)
CREATE TABLE IF NOT EXISTS income_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  source TEXT NOT NULL,
  description TEXT,
  amount REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Moving money between two pockets (e.g. Payroll -> Emergency Fund)
CREATE TABLE IF NOT EXISTS transfers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  to_asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  description TEXT,
  amount REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Monthly spending quota (a budget for daily expenses only, not fixed bills).
-- If no row exists for a given month, the most recent earlier month's quota
-- carries forward, same as a budget that stays put until you change it.
-- asset_id, when set, narrows the quota to only count daily expenses drawn
-- from that one pocket; NULL means it counts daily expenses from any pocket.
CREATE TABLE IF NOT EXISTS spending_quotas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  amount REAL NOT NULL,
  asset_id INTEGER REFERENCES assets(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON expenses(user_id, date);
CREATE INDEX IF NOT EXISTS idx_expenses_asset ON expenses(asset_id);
CREATE INDEX IF NOT EXISTS idx_fixed_expenses_user ON fixed_expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_fixed_expense_payments_lookup ON fixed_expense_payments(fixed_expense_id, year, month);
CREATE INDEX IF NOT EXISTS idx_assets_user ON assets(user_id);
CREATE INDEX IF NOT EXISTS idx_asset_values_asset_date ON asset_values(asset_id, date);
CREATE INDEX IF NOT EXISTS idx_income_user_date ON income_entries(user_id, date);
CREATE INDEX IF NOT EXISTS idx_transfers_user_date ON transfers(user_id, date);
CREATE INDEX IF NOT EXISTS idx_quotas_user_period ON spending_quotas(user_id, year, month);
`);

// Lightweight migrations: add columns that newer versions of the app need,
// without touching any existing data, for people upgrading an existing database.
function hasColumn(table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
}
if (!hasColumn('users', 'recovery_code_hash')) {
  db.exec('ALTER TABLE users ADD COLUMN recovery_code_hash TEXT');
}
if (!hasColumn('spending_quotas', 'asset_id')) {
  db.exec('ALTER TABLE spending_quotas ADD COLUMN asset_id INTEGER REFERENCES assets(id) ON DELETE SET NULL');
}
if (!hasColumn('fixed_expenses', 'asset_id')) {
  db.exec('ALTER TABLE fixed_expenses ADD COLUMN asset_id INTEGER REFERENCES assets(id) ON DELETE SET NULL');
}

module.exports = db;
