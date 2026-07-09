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
CREATE TABLE IF NOT EXISTS fixed_expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  amount REAL NOT NULL,
  day_of_month INTEGER NOT NULL DEFAULT 1, -- billing day, 1-28
  active INTEGER NOT NULL DEFAULT 1,
  start_date TEXT NOT NULL,         -- YYYY-MM-DD, first month it applies
  end_date TEXT,                    -- YYYY-MM-DD or NULL if ongoing
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
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

CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON expenses(user_id, date);
CREATE INDEX IF NOT EXISTS idx_expenses_asset ON expenses(asset_id);
CREATE INDEX IF NOT EXISTS idx_fixed_expenses_user ON fixed_expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_assets_user ON assets(user_id);
CREATE INDEX IF NOT EXISTS idx_asset_values_asset_date ON asset_values(asset_id, date);
CREATE INDEX IF NOT EXISTS idx_income_user_date ON income_entries(user_id, date);
CREATE INDEX IF NOT EXISTS idx_transfers_user_date ON transfers(user_id, date);
`);

module.exports = db;
