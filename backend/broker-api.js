require('dotenv').config();
const express = require('express');
const Redis = require('ioredis');
const protobuf = require('protobufjs');
const bodyParser = require('body-parser');
const cors = require('cors');
const crypto = require('crypto');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { Resend } = require('resend');

// --- Configuration ---
const ADMIN_API_KEY = process.env.API_KEY || 'changeme-generate-a-real-key';
const VALID_ACTIONS = ['BUY', 'SELL', 'CLOSE_BUY', 'CLOSE_SELL', 'MODIFY'];
const TOTAL_SHARDS = parseInt(process.env.TOTAL_SHARDS) || 3;
const JWT_SECRET = process.env.JWT_SECRET || 'changeme-jwt-secret';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD || '';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const COOKIE_OPTS = { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 };
const RESEND_API_KEY = process.env.RESEND_API_KEY;

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

const app = express();
app.use(cors({ credentials: true, origin: FRONTEND_URL }));
app.use(bodyParser.json());
app.use(cookieParser());

// --- Redis with reconnect strategy ---
const redis = new Redis({
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: parseInt(process.env.REDIS_PORT) || 6379,
  retryStrategy: (times) => Math.min(times * 100, 3000),
  maxRetriesPerRequest: null
});

// --- PostgreSQL connection pool (sized for 10K users across 3 cluster instances) ---
// PostgreSQL default max_connections = 100
// 3 PM2 instances × 30 pool connections = 90 (leaves 10 for admin/monitoring)
const pg = new Pool({
  host: process.env.PG_HOST || '127.0.0.1',
  port: parseInt(process.env.PG_PORT) || 5432,
  database: process.env.PG_DATABASE || 'copy_trading',
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || 'postgres',
  max: 30,                    // 30 connections per instance (× 3 instances = 90 total)
  idleTimeoutMillis: 30000,   // Close idle connections after 30s
  connectionTimeoutMillis: 5000,  // Fail fast if pool is exhausted
});

// --- Create all tables on startup ---
pg.query(`
  CREATE TABLE IF NOT EXISTS trade_audit_log (
    id SERIAL PRIMARY KEY,
    master_id INTEGER NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    action VARCHAR(12) NOT NULL,
    price DOUBLE PRECISION NOT NULL,
    received_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS masters (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    api_key VARCHAR(64) UNIQUE NOT NULL,
    status VARCHAR(10) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    balance DOUBLE PRECISION DEFAULT 10000,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    master_id INTEGER REFERENCES masters(id) ON DELETE CASCADE,
    lot_multiplier DOUBLE PRECISION DEFAULT 1.0,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('pending', 'active', 'paused', 'cancelled', 'suspended')),
    paused_reason VARCHAR(255),
    daily_loss_limit DOUBLE PRECISION,
    max_drawdown_percent DOUBLE PRECISION,
    total_profit DOUBLE PRECISION DEFAULT 0,
    total_trades INTEGER DEFAULT 0,
    win_rate DOUBLE PRECISION,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    paused_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    UNIQUE(user_id, master_id)
  );

  CREATE TABLE IF NOT EXISTS copied_trades (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    master_id INTEGER NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    action VARCHAR(12) NOT NULL,
    price DOUBLE PRECISION NOT NULL,
    ticket BIGINT,
    sl DOUBLE PRECISION,
    tp DOUBLE PRECISION,
    lot_size DOUBLE PRECISION DEFAULT 0.01,
    status VARCHAR(10) DEFAULT 'open',
    copied_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS subscription_tiers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(20) UNIQUE NOT NULL,
    max_concurrent_positions INTEGER,
    commission_percent DOUBLE PRECISION DEFAULT 0,
    features TEXT[],
    monthly_fee DOUBLE PRECISION DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS subscription_changes (
    id SERIAL PRIMARY KEY,
    subscription_id INTEGER REFERENCES subscriptions(id) ON DELETE CASCADE,
    changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    change_type VARCHAR(30) NOT NULL,
    old_values JSONB,
    new_values JSONB,
    reason VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS subscription_daily_stats (
    id SERIAL PRIMARY KEY,
    subscription_id INTEGER REFERENCES subscriptions(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    trades_executed INTEGER DEFAULT 0,
    daily_profit_loss DOUBLE PRECISION DEFAULT 0,
    max_open_positions INTEGER DEFAULT 0,
    UNIQUE(subscription_id, date)
  );

  INSERT INTO subscription_tiers (name, max_concurrent_positions, commission_percent, features, monthly_fee)
  VALUES
    ('standard', 10,  0,   ARRAY['basic_copy'], 0),
    ('premium',  25,  1.0, ARRAY['basic_copy','risk_limits','symbol_control'], 0),
    ('vip',      100, 2.0, ARRAY['basic_copy','risk_limits','symbol_control','advanced_analytics'], 0)
  ON CONFLICT (name) DO NOTHING;

  -- Migrations for existing installs
  ALTER TABLE trade_audit_log ALTER COLUMN action TYPE VARCHAR(12);
  ALTER TABLE copied_trades ALTER COLUMN action TYPE VARCHAR(12);
  ALTER TABLE copied_trades ADD COLUMN IF NOT EXISTS ticket BIGINT;
  ALTER TABLE copied_trades ADD COLUMN IF NOT EXISTS sl DOUBLE PRECISION;
  ALTER TABLE copied_trades ADD COLUMN IF NOT EXISTS tp DOUBLE PRECISION;
  ALTER TABLE copied_trades ADD COLUMN IF NOT EXISTS close_price DOUBLE PRECISION;
  ALTER TABLE copied_trades ADD COLUMN IF NOT EXISTS profit_pips DOUBLE PRECISION;
  ALTER TABLE copied_trades ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
  ALTER TABLE masters ADD COLUMN IF NOT EXISTS email VARCHAR(255);
  ALTER TABLE masters ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
  ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token VARCHAR(64);
  ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_expires TIMESTAMPTZ;
  ALTER TABLE masters ADD COLUMN IF NOT EXISTS reset_token VARCHAR(64);
  ALTER TABLE masters ADD COLUMN IF NOT EXISTS reset_expires TIMESTAMPTZ;
  ALTER TABLE masters ADD COLUMN IF NOT EXISTS bio TEXT;
  ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS daily_loss_limit DOUBLE PRECISION;
  ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS max_drawdown_percent DOUBLE PRECISION;
  ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS total_profit DOUBLE PRECISION DEFAULT 0;
  ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS total_trades INTEGER DEFAULT 0;
  ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS win_rate DOUBLE PRECISION;
  ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
  ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS max_position_size DOUBLE PRECISION;
  ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS max_concurrent_positions INTEGER;
  ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS allowed_symbols TEXT[];
  ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS blocked_symbols TEXT[];
  ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS max_positions_per_day INTEGER;
  ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR(20) DEFAULT 'standard';
  ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS commission_percent DOUBLE PRECISION DEFAULT 0;
  ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS roi_percent DOUBLE PRECISION;
  ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS notes TEXT;
  ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS peak_profit DOUBLE PRECISION DEFAULT 0;

  -- Indexes for 10K+ user scale
  CREATE INDEX IF NOT EXISTS idx_trade_audit_master ON trade_audit_log(master_id);
  CREATE INDEX IF NOT EXISTS idx_trade_audit_time ON trade_audit_log(received_at DESC);
  CREATE INDEX IF NOT EXISTS idx_subscriptions_master ON subscriptions(master_id) WHERE status = 'active';
  CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
  CREATE INDEX IF NOT EXISTS idx_subscriptions_user_active ON subscriptions(user_id) WHERE status = 'active';
  CREATE INDEX IF NOT EXISTS idx_copied_trades_user ON copied_trades(user_id, copied_at DESC);
  CREATE INDEX IF NOT EXISTS idx_copied_trades_master ON copied_trades(master_id);
  CREATE INDEX IF NOT EXISTS idx_copied_trades_master_ticket ON copied_trades(master_id, ticket) WHERE status = 'open';
  CREATE INDEX IF NOT EXISTS idx_copied_trades_sub ON copied_trades(user_id, master_id, status);
  CREATE INDEX IF NOT EXISTS idx_masters_status ON masters(status);
  CREATE INDEX IF NOT EXISTS idx_subscription_changes ON subscription_changes(subscription_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_daily_stats ON subscription_daily_stats(subscription_id, date DESC);
`).then(() => {
  console.log('PostgreSQL tables + indexes ready');
}).catch((err) => {
  console.error('PostgreSQL unavailable:', err.message);
});

// Load Protobuf format
const root = protobuf.loadSync("trade.proto");
const TradeSignal = root.lookupType("TradeSignal");

// --- Audit helper: log subscription changes ---
async function logSubscriptionChange(subscriptionId, changedBy, changeType, oldValues, newValues, reason = null) {
  await pg.query(
    `INSERT INTO subscription_changes (subscription_id, changed_by, change_type, old_values, new_values, reason)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [subscriptionId, changedBy || null, changeType,
     oldValues ? JSON.stringify(oldValues) : null,
     newValues ? JSON.stringify(newValues) : null,
     reason]
  ).catch(() => {});
}

// --- Admin API Key Middleware (for master CRUD, admin endpoints) ---
function requireAdminKey(req, res, next) {
  const key = req.headers['x-api-key'];
  if (!key || key !== ADMIN_API_KEY) {
    return res.status(401).json({ error: 'Invalid or missing admin API key' });
  }
  next();
}

// --- Per-Master API Key Middleware (for trade endpoint) ---
// Validates the x-api-key against the master's unique key in the database
async function requireMasterKey(req, res, next) {
  const key = req.headers['x-api-key'];
  if (!key) {
    return res.status(401).json({ error: 'Missing API key' });
  }

  // Also accept admin key for backward compatibility
  if (key === ADMIN_API_KEY) {
    return next();
  }

  try {
    const result = await pg.query(
      'SELECT id FROM masters WHERE api_key = $1 AND status = $2',
      [key, 'active']
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid API key or master is paused' });
    }
    // Attach master_id from the key lookup so the endpoint can use it
    req.authenticatedMasterId = result.rows[0].id;
    next();
  } catch (err) {
    res.status(500).json({ error: 'Auth check failed' });
  }
}

// --- JWT middleware for logged-in users ---
function requireUserJWT(req, res, next) {
  const token = req.cookies?.auth_token;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== 'user') return res.status(403).json({ error: 'Forbidden' });
    req.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired session' });
  }
}

// --- JWT middleware for admin ---
function requireAdminJWT(req, res, next) {
  const token = req.cookies?.auth_token;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired session' });
  }
}

// --- JWT middleware for master traders ---
function requireMasterJWT(req, res, next) {
  const token = req.cookies?.auth_token;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== 'master') return res.status(403).json({ error: 'Forbidden' });
    req.masterId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired session' });
  }
}

// ========================================
// AUTH ENDPOINTS
// ========================================

// POST /api/auth/register — Self-registration for copy traders
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email, and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'password must be at least 6 characters' });
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await pg.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email, balance, created_at',
      [name.trim(), email.trim().toLowerCase(), hash]
    );
    const user = result.rows[0];
    const token = jwt.sign({ sub: user.id, role: 'user' }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('auth_token', token, COOKIE_OPTS);
    res.status(201).json({ user });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already registered' });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/master/register — Self-registration for master traders
app.post('/api/auth/master/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email, and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'password must be at least 6 characters' });
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    const apiKey = crypto.randomBytes(32).toString('hex');
    const result = await pg.query(
      'INSERT INTO masters (name, email, password_hash, api_key) VALUES ($1, $2, $3, $4) RETURNING id, name, email, status, api_key, created_at',
      [name.trim(), email.trim().toLowerCase(), hash, apiKey]
    );
    const master = result.rows[0];
    const token = jwt.sign({ sub: master.id, role: 'master' }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('auth_token', token, COOKIE_OPTS);
    res.status(201).json({ role: 'master', master });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already registered' });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login — Unified login: auto-detects admin vs copy trader vs master trader
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email/username and password are required' });
  }
  try {
    // 1. Check admin credentials (uses username, not email)
    if (ADMIN_PASSWORD_HASH && email.trim() === ADMIN_USERNAME) {
      const valid = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
      if (valid) {
        const token = jwt.sign({ sub: 'admin', role: 'admin' }, JWT_SECRET, { expiresIn: '7d' });
        res.cookie('auth_token', token, COOKIE_OPTS);
        return res.json({ role: 'admin' });
      }
    }
    // 2. Check copy traders (users table) by email
    const userResult = await pg.query(
      'SELECT id, name, email, balance, created_at, password_hash FROM users WHERE email = $1',
      [email.trim().toLowerCase()]
    );
    const user = userResult.rows[0];
    if (user?.password_hash && await bcrypt.compare(password, user.password_hash)) {
      const token = jwt.sign({ sub: user.id, role: 'user' }, JWT_SECRET, { expiresIn: '7d' });
      res.cookie('auth_token', token, COOKIE_OPTS);
      const { password_hash, ...safeUser } = user;
      return res.json({ role: 'user', user: safeUser });
    }
    // 3. Check master traders (masters table) by email
    const masterResult = await pg.query(
      'SELECT id, name, email, status, api_key, password_hash FROM masters WHERE email = $1',
      [email.trim().toLowerCase()]
    );
    const master = masterResult.rows[0];
    if (master?.password_hash && await bcrypt.compare(password, master.password_hash)) {
      const token = jwt.sign({ sub: master.id, role: 'master' }, JWT_SECRET, { expiresIn: '7d' });
      res.cookie('auth_token', token, COOKIE_OPTS);
      const { password_hash, ...safeMaster } = master;
      return res.json({ role: 'master', master: safeMaster });
    }
    return res.status(401).json({ error: 'Invalid credentials' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/logout — Clear session
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('auth_token');
  res.json({ status: 'logged out' });
});

// POST /api/auth/forgot-password — Request reset token
app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Valid email is required' });
  }

  try {
    const emailLower = email.trim().toLowerCase();
    // Check both users and masters
    const userRes = await pg.query('SELECT id, name, "email", \'user\' as role FROM users WHERE email = $1', [emailLower]);
    const masterRes = await pg.query('SELECT id, name, "email", \'master\' as role FROM masters WHERE email = $1', [emailLower]);

    const target = userRes.rows[0] || masterRes.rows[0];
    if (!target) {
      // Return success anyway to prevent email enumeration (security best practice)
      return res.json({ status: 'If this email exists, a reset link has been sent' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 3600000); // 1 hour from now

    const table = target.role === 'user' ? 'users' : 'masters';
    await pg.query(
      `UPDATE ${table} SET reset_token = $1, reset_expires = $2 WHERE id = $3`,
      [token, expires, target.id]
    );

    const resetLink = `${FRONTEND_URL}/reset-password?token=${token}`;

    if (resend) {
      const { data, error: resendError } = await resend.emails.send({
        from: 'HF Copy Trader <onboarding@resend.dev>',
        to: [target.email],
        subject: 'Reset your HF Copy Trader password',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #334155;">
            <h1 style="color: #0f172a; font-size: 24px; font-weight: 700;">Reset your password</h1>
            <p style="font-size: 16px; line-height: 24px;">Hello ${target.name},</p>
            <p style="font-size: 16px; line-height: 24px;">We received a request to reset your password. Click the button below to choose a new one. This link expires in 1 hour.</p>
            <div style="margin: 32px 0;">
              <a href="${resetLink}" style="background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">Reset Password</a>
            </div>
            <p style="font-size: 14px; color: #64748b;">If you didn't request this, you can safely ignore this email.</p>
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 32px 0;" />
            <p style="font-size: 12px; color: #94a3b8;">&copy; 2026 HF Copy Trader. High-frequency real-time copy trading platform.</p>
          </div>
        `
      });

      if (resendError) {
        console.error('[RESEND ERROR]', resendError);
        // We still return 200 to the frontend for security, but we log the error
      } else {
        console.log('[RESEND SUCCESS]', data);
      }
    } else {
      console.log(`[DEV] Password reset for ${target.email}: ${resetLink}`);
    }

    res.json({ status: 'If this email exists, a reset link has been sent' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/reset-password — Update password using token
app.post('/api/auth/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password || password.length < 8) {
    return res.status(400).json({ error: 'Token and a password of at least 8 characters are required' });
  }

  try {
    const hash = await bcrypt.hash(password, 10);

    // Check users
    let result = await pg.query(
      'UPDATE users SET password_hash = $1, reset_token = NULL, reset_expires = NULL WHERE reset_token = $2 AND reset_expires > NOW() RETURNING id',
      [hash, token]
    );

    if (result.rows.length === 0) {
      // Check masters
      result = await pg.query(
        'UPDATE masters SET password_hash = $1, reset_token = NULL, reset_expires = NULL WHERE reset_token = $2 AND reset_expires > NOW() RETURNING id',
        [hash, token]
      );
    }

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    res.json({ status: 'password updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me — Current session info (used by frontend to check auth state)
app.get('/api/auth/me', async (req, res) => {
  const token = req.cookies?.auth_token;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role === 'master') {
      const r = await pg.query(
        'SELECT id, name, email, status, api_key, created_at FROM masters WHERE id = $1',
        [payload.sub]
      );
      if (r.rows.length === 0) return res.status(401).json({ error: 'Master not found' });
      return res.json({ role: 'master', master: r.rows[0] });
    }
    res.json({ role: payload.role, sub: payload.sub });
  } catch {
    res.status(401).json({ error: 'Invalid or expired session' });
  }
});

// ========================================
// USER PORTAL ENDPOINTS (require user JWT)
// ========================================

// GET /api/me — Logged-in user's profile + subscriptions
app.get('/api/me', requireUserJWT, async (req, res) => {
  try {
    const user = await pg.query(
      'SELECT id, name, email, balance, created_at FROM users WHERE id = $1',
      [req.userId]
    );
    if (user.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const subs = await pg.query(`
      SELECT s.*, m.name AS master_name, m.status AS master_status
      FROM subscriptions s
      JOIN masters m ON m.id = s.master_id
      WHERE s.user_id = $1
    `, [req.userId]);
    res.json({ ...user.rows[0], subscriptions: subs.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/me/trades — Logged-in user's copied trades
app.get('/api/me/trades', requireUserJWT, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 500);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);
    const symbol = req.query.symbol?.trim() || null;
    const masterId = req.query.master_id ? parseInt(req.query.master_id) : null;

    const conditions = ['user_id = $1'];
    const params = [req.userId];
    let idx = 2;
    if (symbol) { conditions.push(`symbol ILIKE $${idx++}`); params.push(`%${symbol}%`); }
    if (masterId) { conditions.push(`master_id = $${idx++}`); params.push(masterId); }
    const where = conditions.join(' AND ');

    const [tradesResult, countResult] = await Promise.all([
      pg.query(
        `SELECT * FROM copied_trades WHERE ${where} ORDER BY copied_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, limit, offset]
      ),
      pg.query(`SELECT COUNT(*)::int AS count FROM copied_trades WHERE ${where}`, params)
    ]);
    res.json({ trades: tradesResult.rows, total: countResult.rows[0].count, limit, offset });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/me/profile — Update name/email/password
app.put('/api/me/profile', requireUserJWT, async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const fields = [];
    const values = [];
    let idx = 1;
    if (name) { fields.push(`name = $${idx++}`); values.push(name.trim()); }
    if (email) { fields.push(`email = $${idx++}`); values.push(email.trim().toLowerCase()); }
    if (password) {
      if (password.length < 6) return res.status(400).json({ error: 'password must be at least 6 characters' });
      const hash = await bcrypt.hash(password, 10);
      fields.push(`password_hash = $${idx++}`);
      values.push(hash);
    }
    if (fields.length === 0) return res.status(400).json({ error: 'Nothing to update' });
    values.push(req.userId);
    const result = await pg.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id, name, email, balance, created_at`,
      values
    );
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already exists' });
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/me — Delete account permanently
app.delete('/api/me', requireUserJWT, async (req, res) => {
  try {
    await pg.query('DELETE FROM users WHERE id = $1', [req.userId]);
    res.clearCookie('auth_token');
    res.json({ status: 'deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/me/subscribe — Subscribe to a master
app.post('/api/me/subscribe', requireUserJWT, async (req, res) => {
  const {
    master_id, lot_multiplier, daily_loss_limit, max_drawdown_percent,
    max_position_size, max_concurrent_positions, max_positions_per_day,
    allowed_symbols, blocked_symbols, subscription_tier, notes,
  } = req.body;
  if (!master_id) return res.status(400).json({ error: 'master_id is required' });
  try {
    const result = await pg.query(
      `INSERT INTO subscriptions
       (user_id, master_id, lot_multiplier, daily_loss_limit, max_drawdown_percent,
        max_position_size, max_concurrent_positions, max_positions_per_day,
        allowed_symbols, blocked_symbols, subscription_tier, notes, status, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'active',NOW(),NOW())
       RETURNING *`,
      [
        req.userId, master_id, lot_multiplier || 1.0,
        daily_loss_limit || null, max_drawdown_percent || null,
        max_position_size || null, max_concurrent_positions || null, max_positions_per_day || null,
        allowed_symbols || null, blocked_symbols || null,
        subscription_tier || 'standard', notes || null,
      ]
    );
    const sub = result.rows[0];
    await logSubscriptionChange(sub.id, req.userId, 'created', null, sub);
    res.status(201).json(sub);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Already subscribed' });
    if (err.code === '23503') return res.status(404).json({ error: 'Master not found' });
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/me/subscribe/:masterId — Unsubscribe
app.delete('/api/me/subscribe/:masterId', requireUserJWT, async (req, res) => {
  try {
    const result = await pg.query(
      'DELETE FROM subscriptions WHERE user_id = $1 AND master_id = $2 RETURNING id',
      [req.userId, req.params.masterId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Subscription not found' });
    res.json({ status: 'unsubscribed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/me/subscriptions/:id — Update own subscription
app.put('/api/me/subscriptions/:id', requireUserJWT, async (req, res) => {
  const {
    lot_multiplier, status, paused_reason, daily_loss_limit, max_drawdown_percent,
    max_position_size, max_concurrent_positions, max_positions_per_day,
    allowed_symbols, blocked_symbols, subscription_tier, notes,
  } = req.body;
  try {
    // Fetch current state for audit log
    const current = await pg.query(
      'SELECT * FROM subscriptions WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );
    if (current.rows.length === 0) return res.status(404).json({ error: 'Subscription not found' });
    const old = current.rows[0];

    const fields = [];
    const values = [];
    let idx = 1;
    if (lot_multiplier !== undefined) {
      const parsed = Number(lot_multiplier);
      if (!Number.isFinite(parsed) || parsed <= 0) return res.status(400).json({ error: 'lot_multiplier must be positive' });
      fields.push(`lot_multiplier = $${idx++}`);
      values.push(parsed);
    }
    if (status && ['active', 'paused', 'cancelled', 'pending', 'suspended'].includes(status)) {
      fields.push(`status = $${idx++}`);
      values.push(status);
      if (status === 'paused') {
        fields.push(`paused_at = $${idx++}`);
        values.push(new Date());
      } else if (status === 'active') {
        fields.push(`paused_at = $${idx++}`);
        values.push(null);
      } else if (status === 'cancelled') {
        fields.push(`cancelled_at = $${idx++}`);
        values.push(new Date());
      }
    }
    if (paused_reason !== undefined) { fields.push(`paused_reason = $${idx++}`); values.push(paused_reason); }
    if (daily_loss_limit !== undefined) { fields.push(`daily_loss_limit = $${idx++}`); values.push(daily_loss_limit === null ? null : Number(daily_loss_limit)); }
    if (max_drawdown_percent !== undefined) { fields.push(`max_drawdown_percent = $${idx++}`); values.push(max_drawdown_percent === null ? null : Number(max_drawdown_percent)); }
    if (max_position_size !== undefined) { fields.push(`max_position_size = $${idx++}`); values.push(max_position_size === null ? null : Number(max_position_size)); }
    if (max_concurrent_positions !== undefined) { fields.push(`max_concurrent_positions = $${idx++}`); values.push(max_concurrent_positions === null ? null : parseInt(max_concurrent_positions)); }
    if (max_positions_per_day !== undefined) { fields.push(`max_positions_per_day = $${idx++}`); values.push(max_positions_per_day === null ? null : parseInt(max_positions_per_day)); }
    if (allowed_symbols !== undefined) { fields.push(`allowed_symbols = $${idx++}`); values.push(allowed_symbols); }
    if (blocked_symbols !== undefined) { fields.push(`blocked_symbols = $${idx++}`); values.push(blocked_symbols); }
    if (subscription_tier !== undefined) { fields.push(`subscription_tier = $${idx++}`); values.push(subscription_tier); }
    if (notes !== undefined) { fields.push(`notes = $${idx++}`); values.push(notes); }
    fields.push(`updated_at = $${idx++}`);
    values.push(new Date());
    if (fields.length === 1) return res.status(400).json({ error: 'Nothing to update' });
    values.push(req.params.id, req.userId);
    const result = await pg.query(
      `UPDATE subscriptions SET ${fields.join(', ')} WHERE id = $${idx} AND user_id = $${idx + 1} RETURNING *`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Subscription not found' });
    const updated = result.rows[0];
    const changeType = status && status !== old.status ? `status_${status}` : 'settings_updated';
    await logSubscriptionChange(updated.id, req.userId, changeType, old, updated);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/masters/public — Active masters list for user portal (no API key needed, no api_key field exposed)
app.get('/api/masters/public', requireUserJWT, async (req, res) => {
  try {
    const result = await pg.query(
      'SELECT id, name, status FROM masters WHERE status = $1 ORDER BY name',
      ['active']
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/me/subscriptions/:id/performance — Subscription performance stats
app.get('/api/me/subscriptions/:id/performance', requireUserJWT, async (req, res) => {
  try {
    const result = await pg.query(
      `SELECT id, total_profit, total_trades, win_rate, roi_percent, peak_profit,
              (SELECT COUNT(*) FROM copied_trades WHERE user_id = s.user_id AND master_id = s.master_id AND status = 'open') AS open_positions
       FROM subscriptions s WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Subscription not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/me/subscriptions/:id/daily-stats — Daily stats (last 30 days)
app.get('/api/me/subscriptions/:id/daily-stats', requireUserJWT, async (req, res) => {
  try {
    const sub = await pg.query('SELECT id FROM subscriptions WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
    if (sub.rows.length === 0) return res.status(404).json({ error: 'Subscription not found' });
    const result = await pg.query(
      `SELECT date, trades_executed, daily_profit_loss, max_open_positions
       FROM subscription_daily_stats WHERE subscription_id = $1
       ORDER BY date DESC LIMIT 30`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/me/subscriptions/:id/history — Subscription change audit trail
app.get('/api/me/subscriptions/:id/history', requireUserJWT, async (req, res) => {
  try {
    const sub = await pg.query('SELECT id FROM subscriptions WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
    if (sub.rows.length === 0) return res.status(404).json({ error: 'Subscription not found' });
    const result = await pg.query(
      `SELECT sc.id, sc.change_type, sc.old_values, sc.new_values, sc.reason, sc.created_at,
              u.name AS changed_by_name
       FROM subscription_changes sc
       LEFT JOIN users u ON u.id = sc.changed_by
       WHERE sc.subscription_id = $1
       ORDER BY sc.created_at DESC LIMIT 50`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========================================
// SUBSCRIPTION TIER ENDPOINTS
// ========================================

// GET /api/masters/leaderboard — Public master leaderboard (no auth required)
app.get('/api/masters/leaderboard', async (req, res) => {
  try {
    const sort = req.query.sort || 'win_rate'; // 'win_rate' | 'followers' | 'signals'
    const orderBy = sort === 'followers' ? 'subscriber_count DESC'
                  : sort === 'signals'   ? 'signal_count DESC'
                  : 'avg_win_rate DESC NULLS LAST';
    const result = await pg.query(`
      SELECT m.id, m.name, m.status, m.bio, m.created_at,
        COALESCE(t.signal_count, 0)     AS signal_count,
        t.last_signal_at,
        COALESCE(s.subscriber_count, 0) AS subscriber_count,
        ROUND(COALESCE(wr.avg_win_rate, 0)::numeric, 1) AS avg_win_rate
      FROM masters m
      LEFT JOIN (
        SELECT master_id, COUNT(*) AS signal_count, MAX(received_at) AS last_signal_at
        FROM trade_audit_log GROUP BY master_id
      ) t ON t.master_id = m.id
      LEFT JOIN (
        SELECT master_id, COUNT(*) AS subscriber_count
        FROM subscriptions WHERE status = 'active' GROUP BY master_id
      ) s ON s.master_id = m.id
      LEFT JOIN (
        SELECT master_id, AVG(win_rate) AS avg_win_rate
        FROM subscriptions WHERE win_rate IS NOT NULL GROUP BY master_id
      ) wr ON wr.master_id = m.id
      WHERE m.status = 'active'
      ORDER BY ${orderBy}
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/subscription-tiers — List all tiers (public)
app.get('/api/subscription-tiers', async (req, res) => {
  try {
    const result = await pg.query('SELECT * FROM subscription_tiers ORDER BY monthly_fee ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/subscription-tiers — Create tier (admin)
app.post('/api/subscription-tiers', requireAdminKey, async (req, res) => {
  const { name, max_concurrent_positions, commission_percent, features, monthly_fee } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const result = await pg.query(
      `INSERT INTO subscription_tiers (name, max_concurrent_positions, commission_percent, features, monthly_fee)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, max_concurrent_positions || null, commission_percent || 0, features || [], monthly_fee || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Tier name already exists' });
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/subscription-tiers/:name — Update tier (admin)
app.put('/api/subscription-tiers/:name', requireAdminKey, async (req, res) => {
  const { max_concurrent_positions, commission_percent, features, monthly_fee } = req.body;
  try {
    const result = await pg.query(
      `UPDATE subscription_tiers
       SET max_concurrent_positions = COALESCE($1, max_concurrent_positions),
           commission_percent = COALESCE($2, commission_percent),
           features = COALESCE($3, features),
           monthly_fee = COALESCE($4, monthly_fee)
       WHERE name = $5 RETURNING *`,
      [max_concurrent_positions, commission_percent, features, monthly_fee, req.params.name]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Tier not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/subscriptions/:id/performance — Admin performance view
app.get('/api/subscriptions/:id/performance', requireAdminKey, async (req, res) => {
  try {
    const result = await pg.query(
      `SELECT id, total_profit, total_trades, win_rate, roi_percent, peak_profit,
              (SELECT COUNT(*) FROM copied_trades WHERE user_id = s.user_id AND master_id = s.master_id AND status = 'open') AS open_positions
       FROM subscriptions s WHERE id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Subscription not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/subscriptions/:id/history — Admin audit trail
app.get('/api/subscriptions/:id/history', requireAdminKey, async (req, res) => {
  try {
    const result = await pg.query(
      `SELECT sc.id, sc.change_type, sc.old_values, sc.new_values, sc.reason, sc.created_at,
              u.name AS changed_by_name
       FROM subscription_changes sc
       LEFT JOIN users u ON u.id = sc.changed_by
       WHERE sc.subscription_id = $1
       ORDER BY sc.created_at DESC LIMIT 100`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========================================
// MASTER PORTAL ENDPOINTS (require master JWT)
// ========================================

// GET /api/master-me — Master's own profile + stats
app.get('/api/master-me', requireMasterJWT, async (req, res) => {
  try {
    const result = await pg.query(`
      SELECT m.id, m.name, m.email, m.status, m.api_key, m.bio, m.created_at,
        COALESCE(t.signal_count, 0) AS signal_count,
        t.last_signal_at,
        COALESCE(s.subscriber_count, 0) AS subscriber_count
      FROM masters m
      LEFT JOIN (
        SELECT master_id, COUNT(*) AS signal_count, MAX(received_at) AS last_signal_at
        FROM trade_audit_log GROUP BY master_id
      ) t ON t.master_id = m.id
      LEFT JOIN (
        SELECT master_id, COUNT(*) AS subscriber_count
        FROM subscriptions WHERE status = 'active' GROUP BY master_id
      ) s ON s.master_id = m.id
      WHERE m.id = $1
    `, [req.masterId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Master not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/master-me/trades — Master's own trade history (from audit log)
app.get('/api/master-me/trades', requireMasterJWT, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 500);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);
    const [tradesResult, countResult] = await Promise.all([
      pg.query(
        'SELECT id, symbol, action, price, received_at FROM trade_audit_log WHERE master_id = $1 ORDER BY received_at DESC LIMIT $2 OFFSET $3',
        [req.masterId, limit, offset]
      ),
      pg.query('SELECT COUNT(*)::int AS count FROM trade_audit_log WHERE master_id = $1', [req.masterId])
    ]);
    res.json({ trades: tradesResult.rows, total: countResult.rows[0].count, limit, offset });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/master-me/profile — Update master's name, email, password, or bio
app.put('/api/master-me/profile', requireMasterJWT, async (req, res) => {
  const { name, email, password, bio } = req.body;
  try {
    const fields = [];
    const values = [];
    let idx = 1;
    if (name) { fields.push(`name = $${idx++}`); values.push(name.trim()); }
    if (email) { fields.push(`email = $${idx++}`); values.push(email.trim().toLowerCase()); }
    if (password) {
      if (password.length < 6) return res.status(400).json({ error: 'password must be at least 6 characters' });
      const hash = await bcrypt.hash(password, 10);
      fields.push(`password_hash = $${idx++}`);
      values.push(hash);
    }
    if (bio !== undefined) { fields.push(`bio = $${idx++}`); values.push(bio); }
    if (fields.length === 0) return res.status(400).json({ error: 'Nothing to update' });
    values.push(req.masterId);
    const result = await pg.query(
      `UPDATE masters SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id, name, email, status, api_key, bio, created_at`,
      values
    );
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already exists' });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/master-me/regenerate-key — Regenerate master's own API key
app.post('/api/master-me/regenerate-key', requireMasterJWT, async (req, res) => {
  try {
    const apiKey = crypto.randomBytes(32).toString('hex');
    const result = await pg.query(
      'UPDATE masters SET api_key = $1 WHERE id = $2 RETURNING id, name, email, status, api_key, created_at',
      [apiKey, req.masterId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========================================
// TRADE ENDPOINTS
// ========================================

// POST /api/trade — Broadcast a trade signal (open, close, or modify)
app.post('/api/trade', requireMasterKey, async (req, res) => {
  const { master_id, symbol, action, price, ticket, sl, tp } = req.body;

  if (master_id == null || !symbol || !action || price == null) {
    return res.status(400).json({ error: 'Missing fields: master_id, symbol, action, price are required' });
  }

  const parsedMasterId = Number(master_id);
  const parsedPrice = Number(price);

  if (!Number.isInteger(parsedMasterId) || parsedMasterId <= 0) {
    return res.status(400).json({ error: 'master_id must be a positive integer' });
  }

  // If authenticated via master key, verify master_id matches
  if (req.authenticatedMasterId && req.authenticatedMasterId !== parsedMasterId) {
    return res.status(403).json({ error: 'API key does not match master_id' });
  }

  if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
    return res.status(400).json({ error: 'price must be a positive number' });
  }
  if (typeof symbol !== 'string' || symbol.trim().length === 0) {
    return res.status(400).json({ error: 'symbol must be a non-empty string' });
  }

  const upperAction = String(action).toUpperCase();
  if (!VALID_ACTIONS.includes(upperAction)) {
    return res.status(400).json({ error: `action must be one of: ${VALID_ACTIONS.join(', ')}` });
  }

  const isClose = upperAction.startsWith('CLOSE_');
  const isModify = upperAction === 'MODIFY';
  const hasTicket = ticket !== undefined && ticket !== null && ticket !== '';
  const parsedTicket = hasTicket ? Number(ticket) : null;

  if (hasTicket && (!Number.isInteger(parsedTicket) || parsedTicket <= 0)) {
    return res.status(400).json({ error: 'ticket must be a positive integer' });
  }

  if ((isClose || isModify) && !hasTicket) {
    return res.status(400).json({ error: 'ticket is required for CLOSE/ MODIFY actions' });
  }

  const parsedSl = sl !== undefined && sl !== null ? Number(sl) : 0;
  const parsedTp = tp !== undefined && tp !== null ? Number(tp) : 0;

  const payload = {
    master_id: parsedMasterId,
    symbol: symbol.trim(),
    action: upperAction,
    price: parsedPrice,
    ticket: hasTicket ? parsedTicket : 0,
    sl: parsedSl,
    tp: parsedTp,
  };

  const errMsg = TradeSignal.verify(payload);
  if (errMsg) {
    return res.status(400).json({ error: `Protobuf validation failed: ${errMsg}` });
  }

  const messageBuffer = TradeSignal.encode(TradeSignal.create(payload)).finish();

  const shardId = parsedMasterId % TOTAL_SHARDS;
  redis.publish(`channel:shard_${shardId}`, messageBuffer).catch((err) => {
    console.error('Redis publish failed:', err.message);
  });

  redis.lpush('list:recent_trades', JSON.stringify(payload));
  redis.ltrim('list:recent_trades', 0, 49);

  pg.query(
    'INSERT INTO trade_audit_log (master_id, symbol, action, price) VALUES ($1, $2, $3, $4)',
    [payload.master_id, payload.symbol, payload.action, payload.price]
  ).catch((err) => {
    console.error('Audit log insert failed:', err.message);
  });

  // Handle close signals — mark copied_trades as closed + update P&L stats
  if (isClose) {
    const baseAction = upperAction === 'CLOSE_BUY' ? 'BUY' : 'SELL';
    const closePrice = payload.price;
    try {
      // Close by ticket first, then fallback to symbol+action
      let closedRows = [];
      const closeResult = await pg.query(
        `UPDATE copied_trades
         SET status = 'closed', close_price = $1, closed_at = NOW(),
             profit_pips = CASE WHEN action = 'BUY' THEN $1 - price ELSE price - $1 END
         WHERE master_id = $2 AND ticket = $3 AND status = 'open'
         RETURNING id, user_id, master_id, action, price, profit_pips, lot_size`,
        [closePrice, parsedMasterId, parsedTicket]
      );
      closedRows = closeResult.rows;

      if (closedRows.length === 0) {
        const fallback = await pg.query(
          `UPDATE copied_trades
           SET status = 'closed', close_price = $1, closed_at = NOW(),
               profit_pips = CASE WHEN action = 'BUY' THEN $1 - price ELSE price - $1 END
           WHERE master_id = $2 AND symbol = $3 AND action = $4 AND status = 'open'
             AND (ticket IS NULL OR ticket = 0)
           RETURNING id, user_id, master_id, action, price, profit_pips, lot_size`,
          [closePrice, parsedMasterId, payload.symbol, baseAction]
        );
        closedRows = fallback.rows;
      }

      // Update subscription stats and check drawdown limits for each closed trade
      for (const trade of closedRows) {
        const profitPips = trade.profit_pips || 0;
        const isWin = profitPips > 0;
        try {
          // Update subscription aggregate stats
          const subUpdate = await pg.query(
            `UPDATE subscriptions
             SET total_profit = total_profit + $1,
                 total_trades = total_trades + 1,
                 peak_profit  = GREATEST(COALESCE(peak_profit, 0), total_profit + $1),
                 win_rate = (
                   SELECT COUNT(*) FILTER (WHERE profit_pips > 0) * 100.0 / NULLIF(COUNT(*), 0)
                   FROM copied_trades
                   WHERE user_id = $2 AND master_id = $3 AND status = 'closed'
                 ),
                 updated_at = NOW()
             WHERE user_id = $2 AND master_id = $3
             RETURNING id, total_profit, peak_profit, max_drawdown_percent, status`,
            [profitPips, trade.user_id, trade.master_id]
          );

          if (subUpdate.rows.length > 0) {
            const sub = subUpdate.rows[0];
            // Update daily stats P&L
            await pg.query(
              `INSERT INTO subscription_daily_stats (subscription_id, date, daily_profit_loss)
               VALUES ($1, CURRENT_DATE, $2)
               ON CONFLICT (subscription_id, date)
               DO UPDATE SET daily_profit_loss = subscription_daily_stats.daily_profit_loss + $2`,
              [sub.id, profitPips]
            );
            // Auto-suspend on max drawdown breach
            if (sub.status === 'active' && sub.max_drawdown_percent && sub.peak_profit > 0) {
              const drawdownPct = (sub.peak_profit - sub.total_profit) / sub.peak_profit * 100;
              if (drawdownPct >= sub.max_drawdown_percent) {
                await pg.query(
                  `UPDATE subscriptions SET status = 'suspended', paused_reason = $1, updated_at = NOW() WHERE id = $2`,
                  [`Max drawdown ${sub.max_drawdown_percent}% exceeded`, sub.id]
                );
                await logSubscriptionChange(sub.id, null, 'suspended', { status: 'active' }, { status: 'suspended' }, 'max_drawdown exceeded');
              }
            }
          }
        } catch (statErr) {
          console.error('P&L stat update failed:', statErr.message);
        }
      }
    } catch (err) {
      console.error('Close copied trades failed:', err.message);
    }
  }

  // Handle modify signals — update SL/TP for matched trade
  if (isModify) {
    try {
      const modifyResult = await pg.query(
        `UPDATE copied_trades SET sl = $1, tp = $2
         WHERE master_id = $3 AND ticket = $4 AND status = 'open'`,
        [payload.sl, payload.tp, parsedMasterId, parsedTicket]
      );

      if (modifyResult.rowCount === 0) {
        console.warn(`Modify ignored: no open copied trade for master_id=${parsedMasterId}, ticket=${parsedTicket}`);
      }
    } catch (err) {
      console.error('Modify copied trades failed:', err.message);
    }
  }

  // Handle open signals — auto-copy to subscribed users with enforcement checks
  if (!isClose && !isModify) {
    try {
      const subs = await pg.query(
        'SELECT * FROM subscriptions WHERE master_id = $1 AND status = $2',
        [parsedMasterId, 'active']
      );
      for (const sub of subs.rows) {
        // Symbol whitelist check
        if (sub.allowed_symbols && sub.allowed_symbols.length > 0 && !sub.allowed_symbols.includes(payload.symbol)) continue;
        // Symbol blacklist check
        if (sub.blocked_symbols && sub.blocked_symbols.length > 0 && sub.blocked_symbols.includes(payload.symbol)) continue;

        // Max concurrent positions check
        if (sub.max_concurrent_positions) {
          const openCount = await pg.query(
            `SELECT COUNT(*) FROM copied_trades WHERE user_id = $1 AND master_id = $2 AND status = 'open'`,
            [sub.user_id, parsedMasterId]
          );
          if (parseInt(openCount.rows[0].count) >= sub.max_concurrent_positions) continue;
        }

        // Max positions per day check
        if (sub.max_positions_per_day) {
          const todayStats = await pg.query(
            `SELECT trades_executed FROM subscription_daily_stats WHERE subscription_id = $1 AND date = CURRENT_DATE`,
            [sub.id]
          );
          const executed = todayStats.rows[0]?.trades_executed || 0;
          if (executed >= sub.max_positions_per_day) continue;
        }

        // Daily loss limit check
        if (sub.daily_loss_limit) {
          const todayStats = await pg.query(
            `SELECT daily_profit_loss FROM subscription_daily_stats WHERE subscription_id = $1 AND date = CURRENT_DATE`,
            [sub.id]
          );
          const todayPL = todayStats.rows[0]?.daily_profit_loss || 0;
          if (todayPL <= -sub.daily_loss_limit) continue;
        }

        // Insert copied trade
        await pg.query(
          `INSERT INTO copied_trades (user_id, master_id, symbol, action, price, ticket, sl, tp, lot_size)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            sub.user_id, parsedMasterId, payload.symbol, payload.action, payload.price,
            hasTicket ? parsedTicket : null, payload.sl, payload.tp, 0.01 * sub.lot_multiplier,
          ]
        );

        // Update daily stats (upsert)
        await pg.query(
          `INSERT INTO subscription_daily_stats (subscription_id, date, trades_executed)
           VALUES ($1, CURRENT_DATE, 1)
           ON CONFLICT (subscription_id, date)
           DO UPDATE SET trades_executed = subscription_daily_stats.trades_executed + 1`,
          [sub.id]
        );
      }
    } catch (err) {
      console.error('Copy trades failed:', err.message);
    }
  }

  console.log(`Broadcast: ${payload.action} ${payload.symbol} from Master #${payload.master_id}`);
  res.json({ status: "OK" });
});

// GET /api/trades/latest — Recent trades for EA sync
app.get('/api/trades/latest', requireAdminKey, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 10, 50);
  const trades = await redis.lrange('list:recent_trades', 0, limit - 1);
  res.json(trades.map((t) => JSON.parse(t)));
});

// GET /api/trades/history — Historical trades from audit log
app.get('/api/trades/history', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 200, 500);
    const result = await pg.query(
      'SELECT master_id, symbol, action, price, received_at FROM trade_audit_log ORDER BY received_at DESC LIMIT $1',
      [limit]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch trade history' });
  }
});

// ========================================
// MASTER ENDPOINTS
// ========================================

// GET /api/masters — List all masters with stats
app.get('/api/masters', requireAdminKey, async (req, res) => {
  try {
    const result = await pg.query(`
      SELECT m.*,
        COALESCE(t.signal_count, 0) AS signal_count,
        t.last_signal_at,
        COALESCE(s.subscriber_count, 0) AS subscriber_count
      FROM masters m
      LEFT JOIN (
        SELECT master_id, COUNT(*) AS signal_count, MAX(received_at) AS last_signal_at
        FROM trade_audit_log GROUP BY master_id
      ) t ON t.master_id = m.id
      LEFT JOIN (
        SELECT master_id, COUNT(*) AS subscriber_count
        FROM subscriptions WHERE status = 'active' GROUP BY master_id
      ) s ON s.master_id = m.id
      ORDER BY m.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/masters — Create a master
app.post('/api/masters', requireAdminKey, async (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'name is required' });
  }
  try {
    const apiKey = crypto.randomBytes(32).toString('hex');
    const result = await pg.query(
      'INSERT INTO masters (name, api_key) VALUES ($1, $2) RETURNING *',
      [name.trim(), apiKey]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/masters/:id — Update master
app.put('/api/masters/:id', requireAdminKey, async (req, res) => {
  const { name, status } = req.body;
  const { id } = req.params;
  try {
    const fields = [];
    const values = [];
    let idx = 1;

    if (name) { fields.push(`name = $${idx++}`); values.push(name.trim()); }
    if (status && ['active', 'paused'].includes(status)) { fields.push(`status = $${idx++}`); values.push(status); }

    if (fields.length === 0) return res.status(400).json({ error: 'Nothing to update' });

    values.push(id);
    const result = await pg.query(
      `UPDATE masters SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Master not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/masters/:id — Remove master
app.delete('/api/masters/:id', requireAdminKey, async (req, res) => {
  try {
    const result = await pg.query('DELETE FROM masters WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Master not found' });
    res.json({ status: 'deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/masters/:id/trades — Trade history for a specific master
app.get('/api/masters/:id/trades', requireAdminKey, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const result = await pg.query(
      'SELECT master_id, symbol, action, price, received_at FROM trade_audit_log WHERE master_id = $1 ORDER BY received_at DESC LIMIT $2',
      [req.params.id, limit]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/masters/:id/regenerate-key — Regenerate API key
app.put('/api/masters/:id/regenerate-key', requireAdminKey, async (req, res) => {
  try {
    const apiKey = crypto.randomBytes(32).toString('hex');
    const result = await pg.query(
      'UPDATE masters SET api_key = $1 WHERE id = $2 RETURNING *',
      [apiKey, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Master not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========================================
// USER ENDPOINTS
// ========================================

// GET /api/users — List all users
app.get('/api/users', requireAdminKey, async (req, res) => {
  try {
    const result = await pg.query('SELECT id, name, email, balance, created_at FROM users ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users — Create user
app.post('/api/users', requireAdminKey, async (req, res) => {
  const { name, email } = req.body;
  if (!name || !email) {
    return res.status(400).json({ error: 'name and email are required' });
  }
  try {
    const result = await pg.query(
      'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id, name, email, balance, created_at',
      [name.trim(), email.trim().toLowerCase()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already exists' });
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/:id — User profile with subscriptions
app.get('/api/users/:id', requireAdminKey, async (req, res) => {
  try {
    const user = await pg.query('SELECT id, name, email, balance, created_at FROM users WHERE id = $1', [req.params.id]);
    if (user.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const subs = await pg.query(`
      SELECT s.*, m.name AS master_name, m.status AS master_status
      FROM subscriptions s
      JOIN masters m ON m.id = s.master_id
      WHERE s.user_id = $1
    `, [req.params.id]);

    res.json({ ...user.rows[0], subscriptions: subs.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/users/:id — Update user
app.put('/api/users/:id', requireAdminKey, async (req, res) => {
  const { name, email } = req.body;
  const { id } = req.params;
  try {
    const fields = [];
    const values = [];
    let idx = 1;

    if (name) { fields.push(`name = $${idx++}`); values.push(name.trim()); }
    if (email) { fields.push(`email = $${idx++}`); values.push(email.trim().toLowerCase()); }

    if (fields.length === 0) return res.status(400).json({ error: 'Nothing to update' });

    values.push(id);
    const result = await pg.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id, name, email, balance, created_at`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already exists' });
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/users/:id — Delete user (cascades subscriptions + copied_trades)
app.delete('/api/users/:id', requireAdminKey, async (req, res) => {
  try {
    const result = await pg.query('DELETE FROM users WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ status: 'deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========================================
// SUBSCRIPTION ENDPOINTS
// ========================================

// POST /api/users/:id/subscribe — Admin subscribe user to a master
app.post('/api/users/:id/subscribe', requireAdminKey, async (req, res) => {
  const {
    master_id, lot_multiplier, daily_loss_limit, max_drawdown_percent,
    max_position_size, max_concurrent_positions, max_positions_per_day,
    allowed_symbols, blocked_symbols, subscription_tier, notes,
  } = req.body;
  if (!master_id) return res.status(400).json({ error: 'master_id is required' });
  try {
    const result = await pg.query(
      `INSERT INTO subscriptions
       (user_id, master_id, lot_multiplier, daily_loss_limit, max_drawdown_percent,
        max_position_size, max_concurrent_positions, max_positions_per_day,
        allowed_symbols, blocked_symbols, subscription_tier, notes, status, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'active',NOW(),NOW())
       RETURNING *`,
      [
        req.params.id, master_id, lot_multiplier || 1.0,
        daily_loss_limit || null, max_drawdown_percent || null,
        max_position_size || null, max_concurrent_positions || null, max_positions_per_day || null,
        allowed_symbols || null, blocked_symbols || null,
        subscription_tier || 'standard', notes || null,
      ]
    );
    const sub = result.rows[0];
    await logSubscriptionChange(sub.id, null, 'created', null, sub, 'admin_created');
    res.status(201).json(sub);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Already subscribed' });
    if (err.code === '23503') return res.status(404).json({ error: 'User or master not found' });
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/users/:id/subscribe/:masterId — Unsubscribe
app.delete('/api/users/:id/subscribe/:masterId', requireAdminKey, async (req, res) => {
  try {
    const result = await pg.query(
      'DELETE FROM subscriptions WHERE user_id = $1 AND master_id = $2 RETURNING id',
      [req.params.id, req.params.masterId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Subscription not found' });
    res.json({ status: 'unsubscribed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/subscriptions/:id — Admin update any subscription
app.put('/api/subscriptions/:id', requireAdminKey, async (req, res) => {
  const {
    lot_multiplier, status, paused_reason, daily_loss_limit, max_drawdown_percent,
    max_position_size, max_concurrent_positions, max_positions_per_day,
    allowed_symbols, blocked_symbols, subscription_tier, notes,
    total_profit, total_trades, win_rate, roi_percent,
  } = req.body;
  const { id } = req.params;
  try {
    const current = await pg.query('SELECT * FROM subscriptions WHERE id = $1', [id]);
    if (current.rows.length === 0) return res.status(404).json({ error: 'Subscription not found' });
    const old = current.rows[0];

    const fields = [];
    const values = [];
    let idx = 1;

    if (lot_multiplier !== undefined) {
      const parsed = Number(lot_multiplier);
      if (!Number.isFinite(parsed) || parsed <= 0) return res.status(400).json({ error: 'lot_multiplier must be a positive number' });
      fields.push(`lot_multiplier = $${idx++}`); values.push(parsed);
    }
    if (status && ['active', 'paused', 'cancelled', 'pending', 'suspended'].includes(status)) {
      fields.push(`status = $${idx++}`); values.push(status);
      if (status === 'paused') { fields.push(`paused_at = $${idx++}`); values.push(new Date()); }
      else if (status === 'active') { fields.push(`paused_at = $${idx++}`); values.push(null); }
      else if (status === 'cancelled') { fields.push(`cancelled_at = $${idx++}`); values.push(new Date()); }
    }
    if (paused_reason !== undefined) { fields.push(`paused_reason = $${idx++}`); values.push(paused_reason); }
    if (daily_loss_limit !== undefined) { fields.push(`daily_loss_limit = $${idx++}`); values.push(daily_loss_limit === null ? null : Number(daily_loss_limit)); }
    if (max_drawdown_percent !== undefined) { fields.push(`max_drawdown_percent = $${idx++}`); values.push(max_drawdown_percent === null ? null : Number(max_drawdown_percent)); }
    if (max_position_size !== undefined) { fields.push(`max_position_size = $${idx++}`); values.push(max_position_size === null ? null : Number(max_position_size)); }
    if (max_concurrent_positions !== undefined) { fields.push(`max_concurrent_positions = $${idx++}`); values.push(max_concurrent_positions === null ? null : parseInt(max_concurrent_positions)); }
    if (max_positions_per_day !== undefined) { fields.push(`max_positions_per_day = $${idx++}`); values.push(max_positions_per_day === null ? null : parseInt(max_positions_per_day)); }
    if (allowed_symbols !== undefined) { fields.push(`allowed_symbols = $${idx++}`); values.push(allowed_symbols); }
    if (blocked_symbols !== undefined) { fields.push(`blocked_symbols = $${idx++}`); values.push(blocked_symbols); }
    if (subscription_tier !== undefined) { fields.push(`subscription_tier = $${idx++}`); values.push(subscription_tier); }
    if (notes !== undefined) { fields.push(`notes = $${idx++}`); values.push(notes); }
    if (total_profit !== undefined) { const p = Number(total_profit); if (Number.isFinite(p)) { fields.push(`total_profit = $${idx++}`); values.push(p); } }
    if (total_trades !== undefined) { const p = Number(total_trades); if (Number.isFinite(p) && p >= 0) { fields.push(`total_trades = $${idx++}`); values.push(p); } }
    if (win_rate !== undefined) { const p = win_rate === null ? null : Number(win_rate); if (p === null || (Number.isFinite(p) && p >= 0 && p <= 100)) { fields.push(`win_rate = $${idx++}`); values.push(p); } }
    if (roi_percent !== undefined) { fields.push(`roi_percent = $${idx++}`); values.push(roi_percent === null ? null : Number(roi_percent)); }

    fields.push(`updated_at = $${idx++}`);
    values.push(new Date());
    if (fields.length === 1) return res.status(400).json({ error: 'Nothing to update' });
    values.push(id);
    const result = await pg.query(
      `UPDATE subscriptions SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Subscription not found' });
    const updated = result.rows[0];
    await logSubscriptionChange(updated.id, null, 'admin_updated', old, updated);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/:id/trades — Copied trades for a user (with pagination)
app.get('/api/users/:id/trades', requireAdminKey, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 500);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);

    const [tradesResult, countResult] = await Promise.all([
      pg.query(
        'SELECT * FROM copied_trades WHERE user_id = $1 ORDER BY copied_at DESC LIMIT $2 OFFSET $3',
        [req.params.id, limit, offset]
      ),
      pg.query('SELECT COUNT(*)::int AS count FROM copied_trades WHERE user_id = $1', [req.params.id])
    ]);

    res.json({
      trades: tradesResult.rows,
      total: countResult.rows[0].count,
      limit,
      offset
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Run on Port 4000
app.listen(4000, () => {
  console.log(`✅ Broker API running on Port 4000`);
});
