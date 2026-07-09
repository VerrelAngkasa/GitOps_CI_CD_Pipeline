# MyLedger — Personal Net Worth Tracker

A self-hosted, single-user app for tracking pockets of money (bank accounts,
savings, investments), logging income and expenses against them, and
generating monthly reports. Amounts are shown in Indonesian Rupiah (IDR).

- **Backend:** Node.js + Express + SQLite (better-sqlite3), JWT auth in an httpOnly cookie
- **Frontend:** React + Vite + Tailwind CSS, Recharts for charts

All data is stored locally in a SQLite file — nothing leaves your machine.

## Project structure

```
networth-tracker/
├── backend/     Express API + SQLite database
└── frontend/    React app (Vite)
```

## 1. Requirements

- Node.js 18 or newer (check with `node -v`)
- npm (comes with Node)

## 2. Set up the backend

```bash
cd backend
npm install
```

Open `.env` and set `JWT_SECRET` to a long random string (used to sign login
sessions). A placeholder is included — replace it before real use:

```
PORT=4000
JWT_SECRET=change_this_to_a_long_random_string_before_real_use
NODE_ENV=development
```

Start the API:

```bash
npm run dev      # auto-restarts on changes, via nodemon
# or
npm start        # plain node
```

The API runs at `http://localhost:4000`. On first boot it creates a SQLite
database at `backend/data/networth.sqlite` and the tables it needs — no manual
migration step required.

## 3. Set up the frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

The app runs at `http://localhost:5173` and proxies API requests to the
backend automatically (see `frontend/vite.config.js`).

## 4. First run

Open `http://localhost:5173`. Since this is a single-user app, the first time
you open it you'll be asked to create the one account for your ledger — a
username, display name, and password. **Registration closes automatically
after this step** — the `/api/auth/register` route refuses to create a second
account — so there's always exactly one login for your data.

After that, you'll sign in with that username and password on future visits.
Sessions last 7 days and are stored in an httpOnly cookie.

## 5. The pocket model

This app is built around **pockets** — the Assets page is really a list of
accounts you move money in and out of (Payroll Account, Emergency Fund,
Holiday Savings, an investment account, etc.), plus any illiquid assets
(property, vehicles) or liabilities (loans, enter as negative values) you
want to include in net worth.

- **Income** — log money landing in a pocket (salary, bonus, gift...). It
  increases that pocket's balance immediately.
- **Transfers** — move money between two pockets (e.g. Payroll → Emergency
  Fund). The source pocket decreases and the destination increases.
- **Daily Expenses** — optionally choose a pocket when logging a purchase.
  If you pick "Emergency Fund," only that pocket's balance goes down — your
  other pockets are untouched. Leave it as "None" to just log the spend
  without affecting any pocket balance.
- **Fixed Expenses** — recurring monthly bills (rent, subscriptions) used for
  reporting/projection. These are not tied to a pocket balance automatically,
  since they represent a recurring obligation rather than a single booked
  transaction.

Every pocket's "current value" is always its most recent recorded balance.
Income, transfers, and pocket-linked expenses all write a new balance
snapshot; you can also manually "Update value" on the Assets page any time to
reconcile against your real bank balance (useful for investment accounts
whose value moves on its own).

**Percentages**: each pocket on the Assets page and in the Monthly Report
shows its share of your total (positive) assets, so you can see at a glance
how your money is spread across pockets.

**Fixing a mis-input**: click **History** on any asset to see every balance
snapshot recorded for it, and delete individual entries — the most recent
remaining one becomes the pocket's current balance. This is the way to
correct a wrong amount without needing to archive the whole asset.

## 6. Using the app

- **Dashboard** — net worth headline, 12-month trend, and quick totals for
  assets, liabilities, income this month, and spending this month.
- **Daily Expenses** — one-off spending with an optional pocket.
- **Fixed Expenses** — recurring monthly items; pause instead of delete.
- **Income** — money landing in a pocket, with a source (Salary, Bonus, etc).
- **Transfers** — move money between two pockets.
- **Assets** — every pocket and asset, with percentage of total, value
  history, and manual value updates.
- **Monthly Report** — net worth at month end and its change, income vs.
  spending, an interactive spending-by-category donut chart (hover or click a
  slice/legend pill to filter the tables below), the asset breakdown with
  percentages, and full expense listings for the month.

## 7. Backing up your data

Everything lives in one file: `backend/data/networth.sqlite`. Copy that file
somewhere safe to back up your ledger, or copy it back to restore.

## 8. Running it long-term

For everyday personal use, running `npm run dev` in both folders whenever you
want to use the app is enough. If you'd like it to run in the background or
start automatically:

```bash
# Backend
cd backend
npm start                     # or use pm2 / a systemd service

# Frontend — build static files and serve them
cd frontend
npm run build                 # outputs to frontend/dist
npx serve dist                # or any static file server
```

If you serve the built frontend from a different origin than `localhost:5173`,
update `CLIENT_ORIGIN` in `backend/.env` so CORS allows it, and point the
frontend's API calls at the backend's real URL.

## Notes on security

This app is built for personal, local use. The single-account model, JWT
cookie auth, and bcrypt password hashing are reasonable for that. If you ever
expose it beyond your own machine (e.g. host it on the internet), put it
behind HTTPS and treat `JWT_SECRET` as a real secret.
