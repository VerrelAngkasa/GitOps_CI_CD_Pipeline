const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireAuth, startSession, COOKIE_OPTS } = require('../middleware/auth');
const { generateRecoveryCode } = require('../utils/recoveryCode');

const router = express.Router();

const MIN_IDLE_TIMEOUT = 1;
const MAX_IDLE_TIMEOUT = 240; // 4 hours

// Registration is only allowed while there are zero users, so this app
// stays single-user. Once an account exists, this route is closed.
router.post('/register', (req, res) => {
  const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  if (userCount > 0) {
    return res.status(403).json({ error: 'An account already exists. Registration is closed.' });
  }

  const { username, password, displayName } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }
  if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(username)) {
    return res.status(400).json({ error: 'Username must be 3-32 characters (letters, numbers, _ . -).' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  const passwordHash = bcrypt.hashSync(password, 12);
  const recoveryCode = generateRecoveryCode();
  const recoveryCodeHash = bcrypt.hashSync(recoveryCode, 12);

  const info = db
    .prepare('INSERT INTO users (username, password_hash, recovery_code_hash, display_name) VALUES (?, ?, ?, ?)')
    .run(username.toLowerCase().trim(), passwordHash, recoveryCodeHash, displayName || null);

  const user = db.prepare('SELECT idle_timeout_minutes FROM users WHERE id = ?').get(info.lastInsertRowid);
  startSession(res, info.lastInsertRowid, user.idle_timeout_minutes);
  // The recovery code is only ever shown once, right here — it's not recoverable after this.
  res.json({
    id: info.lastInsertRowid,
    username,
    displayName: displayName || null,
    idleTimeoutMinutes: user.idle_timeout_minutes,
    recoveryCode,
  });
});

router.get('/setup-status', (req, res) => {
  const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  res.json({ needsSetup: userCount === 0 });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.toLowerCase().trim());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  startSession(res, user.id, user.idle_timeout_minutes);
  res.json({
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    idleTimeoutMinutes: user.idle_timeout_minutes,
  });
});

router.post('/logout', (req, res) => {
  res.clearCookie('token', COOKIE_OPTS);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  const user = db
    .prepare('SELECT id, username, display_name, idle_timeout_minutes FROM users WHERE id = ?')
    .get(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    idleTimeoutMinutes: user.idle_timeout_minutes,
  });
});

// How long the session stays alive without activity before requiring sign-in
// again. Every authenticated request silently extends the session (see the
// requireAuth middleware), so this only matters after genuine inactivity —
// there's also a fixed 7-day ceiling regardless of activity, for safety.
router.put('/session-settings', requireAuth, (req, res) => {
  const { idleTimeoutMinutes } = req.body || {};
  const minutes = Number(idleTimeoutMinutes);
  if (!Number.isFinite(minutes) || minutes < MIN_IDLE_TIMEOUT || minutes > MAX_IDLE_TIMEOUT) {
    return res.status(400).json({ error: `Choose a timeout between ${MIN_IDLE_TIMEOUT} and ${MAX_IDLE_TIMEOUT} minutes.` });
  }

  db.prepare('UPDATE users SET idle_timeout_minutes = ? WHERE id = ?').run(minutes, req.userId);
  startSession(res, req.userId, minutes); // refresh the cookie so the new duration applies immediately
  res.json({ idleTimeoutMinutes: minutes });
});

// Forgotten-password recovery: no login required, but you need the recovery
// code shown once at account creation (or the last time it was regenerated).
// A new recovery code is issued on success, since the old one is now spent.
router.post('/reset-password', (req, res) => {
  const { username, recoveryCode, newPassword } = req.body || {};
  if (!username || !recoveryCode || !newPassword) {
    return res.status(400).json({ error: 'Username, recovery code and new password are required.' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.toLowerCase().trim());
  if (!user || !user.recovery_code_hash || !bcrypt.compareSync(recoveryCode.trim(), user.recovery_code_hash)) {
    return res.status(401).json({ error: 'That username and recovery code don\u2019t match.' });
  }

  const passwordHash = bcrypt.hashSync(newPassword, 12);
  const newRecoveryCode = generateRecoveryCode();
  const newRecoveryCodeHash = bcrypt.hashSync(newRecoveryCode, 12);

  db.prepare('UPDATE users SET password_hash = ?, recovery_code_hash = ? WHERE id = ?').run(
    passwordHash,
    newRecoveryCodeHash,
    user.id
  );

  res.json({ ok: true, recoveryCode: newRecoveryCode });
});

// Change password while logged in — requires the current password.
router.post('/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new password are required.' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  if (!user || !bcrypt.compareSync(currentPassword, user.password_hash)) {
    return res.status(401).json({ error: 'Current password is incorrect.' });
  }

  const passwordHash = bcrypt.hashSync(newPassword, 12);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, user.id);
  res.json({ ok: true });
});

// Issue a fresh recovery code, invalidating the old one. Requires the
// current password so a logged-in session alone can't silently rotate it.
router.post('/recovery-code/regenerate', requireAuth, (req, res) => {
  const { password } = req.body || {};
  if (!password) {
    return res.status(400).json({ error: 'Enter your password to confirm.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Password is incorrect.' });
  }

  const recoveryCode = generateRecoveryCode();
  const recoveryCodeHash = bcrypt.hashSync(recoveryCode, 12);
  db.prepare('UPDATE users SET recovery_code_hash = ? WHERE id = ?').run(recoveryCodeHash, user.id);

  res.json({ recoveryCode });
});

module.exports = router;
