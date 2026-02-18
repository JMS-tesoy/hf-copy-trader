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

// --- Configuration ---
const ADMIN_API_KEY = process.env.API_KEY || 'changeme-generate-a-real-key';
const VALID_ACTIONS = ['BUY', 'SELL', 'CLOSE_BUY', 'CLOSE_SELL', 'MODIFY'];
const JWT_SECRET = process.env.JWT_SECRET || 'changeme-jwt-secret';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD || '';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const COOKIE_OPTS = { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 };

const app = express();
app.use(cors({ credentials: true, origin: FRONTEND_URL }));
app.use(bodyParser.json());
app.use(cookieParser());

// --- Redis with reconnect strategy ---
const redis = new Redis({
  host: "127.0.0.1",
  port: 6379,
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
    status VARCHAR(10) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
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

  -- Migrations for existing installs
  ALTER TABLE trade_audit_log ALTER COLUMN action TYPE VARCHAR(12);
  ALTER TABLE copied_trades ALTER COLUMN action TYPE VARCHAR(12);
  ALTER TABLE copied_trades ADD COLUMN IF NOT EXISTS ticket BIGINT;
  ALTER TABLE copied_trades ADD COLUMN IF NOT EXISTS sl DOUBLE PRECISION;
  ALTER TABLE copied_trades ADD COLUMN IF NOT EXISTS tp DOUBLE PRECISION;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);

  -- Indexes for 10K+ user scale
  CREATE INDEX IF NOT EXISTS idx_trade_audit_master ON trade_audit_log(master_id);
  CREATE INDEX IF NOT EXISTS idx_trade_audit_time ON trade_audit_log(received_at DESC);
  CREATE INDEX IF NOT EXISTS idx_subscriptions_master ON subscriptions(master_id) WHERE status = 'active';
  CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
  CREATE INDEX IF NOT EXISTS idx_copied_trades_user ON copied_trades(user_id, copied_at DESC);
  CREATE INDEX IF NOT EXISTS idx_copied_trades_master ON copied_trades(master_id);
  CREATE INDEX IF NOT EXISTS idx_copied_trades_master_ticket ON copied_trades(master_id, ticket) WHERE status = 'open';
  CREATE INDEX IF NOT EXISTS idx_masters_status ON masters(status);
`).then(() => {
  console.log('PostgreSQL tables + indexes ready');
}).catch((err) => {
  console.error('PostgreSQL unavailable:', err.message);
});

// Load Protobuf format
const root = protobuf.loadSync("trade.proto");
const TradeSignal = root.lookupType("TradeSignal");

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

// POST /api/auth/login — Unified login: auto-detects admin vs copy trader
// Admin: use admin username + password → role: 'admin' → redirect to dashboard
// Trader: use email + password → role: 'user' → redirect to portal
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email/username and password are required' });
  }
  try {
    // Check admin credentials first (admin uses username, not email)
    if (ADMIN_PASSWORD_HASH && email.trim() === ADMIN_USERNAME) {
      const valid = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
      if (valid) {
        const token = jwt.sign({ sub: 'admin', role: 'admin' }, JWT_SECRET, { expiresIn: '7d' });
        res.cookie('auth_token', token, COOKIE_OPTS);
        return res.json({ role: 'admin' });
      }
    }
    // Check user credentials by email
    const result = await pg.query(
      'SELECT id, name, email, balance, created_at, password_hash FROM users WHERE email = $1',
      [email.trim().toLowerCase()]
    );
    const user = result.rows[0];
    if (!user || !user.password_hash) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ sub: user.id, role: 'user' }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('auth_token', token, COOKIE_OPTS);
    const { password_hash, ...safeUser } = user;
    return res.json({ role: 'user', user: safeUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/logout — Clear session
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('auth_token');
  res.json({ status: 'logged out' });
});

// GET /api/auth/me — Current session info (used by frontend to check auth)
app.get('/api/auth/me', (req, res) => {
  const token = req.cookies?.auth_token;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
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
    const [tradesResult, countResult] = await Promise.all([
      pg.query(
        'SELECT * FROM copied_trades WHERE user_id = $1 ORDER BY copied_at DESC LIMIT $2 OFFSET $3',
        [req.userId, limit, offset]
      ),
      pg.query('SELECT COUNT(*)::int AS count FROM copied_trades WHERE user_id = $1', [req.userId])
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

// POST /api/me/subscribe — Subscribe to a master
app.post('/api/me/subscribe', requireUserJWT, async (req, res) => {
  const { master_id, lot_multiplier } = req.body;
  if (!master_id) return res.status(400).json({ error: 'master_id is required' });
  try {
    const result = await pg.query(
      'INSERT INTO subscriptions (user_id, master_id, lot_multiplier) VALUES ($1, $2, $3) RETURNING *',
      [req.userId, master_id, lot_multiplier || 1.0]
    );
    res.status(201).json(result.rows[0]);
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
  const { lot_multiplier, status } = req.body;
  try {
    const fields = [];
    const values = [];
    let idx = 1;
    if (lot_multiplier !== undefined) {
      const parsed = Number(lot_multiplier);
      if (!Number.isFinite(parsed) || parsed <= 0) return res.status(400).json({ error: 'lot_multiplier must be positive' });
      fields.push(`lot_multiplier = $${idx++}`);
      values.push(parsed);
    }
    if (status && ['active', 'paused'].includes(status)) { fields.push(`status = $${idx++}`); values.push(status); }
    if (fields.length === 0) return res.status(400).json({ error: 'Nothing to update' });
    values.push(req.params.id, req.userId);
    const result = await pg.query(
      `UPDATE subscriptions SET ${fields.join(', ')} WHERE id = $${idx} AND user_id = $${idx + 1} RETURNING *`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Subscription not found' });
    res.json(result.rows[0]);
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

  redis.publish('channel:global_trades', messageBuffer).catch((err) => {
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

  // Handle close signals — mark copied_trades as closed
  if (isClose) {
    const baseAction = upperAction === 'CLOSE_BUY' ? 'BUY' : 'SELL';
    try {
      const closeResult = await pg.query(
        `UPDATE copied_trades SET status = 'closed'
         WHERE master_id = $1 AND ticket = $2 AND status = 'open'`,
        [parsedMasterId, parsedTicket]
      );

      if (closeResult.rowCount === 0) {
        await pg.query(
          `UPDATE copied_trades SET status = 'closed'
           WHERE master_id = $1 AND symbol = $2 AND action = $3 AND status = 'open'
             AND (ticket IS NULL OR ticket = 0)`,
          [parsedMasterId, payload.symbol, baseAction]
        );
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

  // Handle open signals — auto-copy to subscribed users
  if (!isClose && !isModify) {
    try {
      const subs = await pg.query(
        'SELECT user_id, lot_multiplier FROM subscriptions WHERE master_id = $1 AND status = $2',
        [parsedMasterId, 'active']
      );
      for (const sub of subs.rows) {
        pg.query(
          'INSERT INTO copied_trades (user_id, master_id, symbol, action, price, ticket, sl, tp, lot_size) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
          [
            sub.user_id,
            parsedMasterId,
            payload.symbol,
            payload.action,
            payload.price,
            hasTicket ? parsedTicket : null,
            payload.sl,
            payload.tp,
            0.01 * sub.lot_multiplier,
          ]
        ).catch(() => {});
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

// POST /api/users/:id/subscribe — Subscribe to a master
app.post('/api/users/:id/subscribe', requireAdminKey, async (req, res) => {
  const { master_id, lot_multiplier } = req.body;
  if (!master_id) return res.status(400).json({ error: 'master_id is required' });
  try {
    const result = await pg.query(
      'INSERT INTO subscriptions (user_id, master_id, lot_multiplier) VALUES ($1, $2, $3) RETURNING *',
      [req.params.id, master_id, lot_multiplier || 1.0]
    );
    res.status(201).json(result.rows[0]);
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

// PUT /api/subscriptions/:id — Update subscription (lot_multiplier, status)
app.put('/api/subscriptions/:id', requireAdminKey, async (req, res) => {
  const { lot_multiplier, status } = req.body;
  const { id } = req.params;
  try {
    const fields = [];
    const values = [];
    let idx = 1;

    if (lot_multiplier !== undefined) {
      const parsed = Number(lot_multiplier);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return res.status(400).json({ error: 'lot_multiplier must be a positive number' });
      }
      fields.push(`lot_multiplier = $${idx++}`);
      values.push(parsed);
    }
    if (status && ['active', 'paused'].includes(status)) {
      fields.push(`status = $${idx++}`);
      values.push(status);
    }

    if (fields.length === 0) return res.status(400).json({ error: 'Nothing to update' });

    values.push(id);
    const result = await pg.query(
      `UPDATE subscriptions SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Subscription not found' });
    res.json(result.rows[0]);
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
