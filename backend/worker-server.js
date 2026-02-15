require('dotenv').config();
const WebSocket = require('ws');
const Redis = require('ioredis');
const protobuf = require('protobufjs');

// --- Performance: Increase max listeners for 10K+ connections ---
require('events').defaultMaxListeners = 0;

// --- Redis with reconnect strategy ---
const redis = new Redis({
  host: "127.0.0.1",
  port: 6379,
  retryStrategy: (times) => Math.min(times * 100, 3000),
  maxRetriesPerRequest: null,
  enableReadyCheck: false
});

const redisChannel = 'channel:global_trades';

// Heartbeat: 30s interval, prune dead connections
const HEARTBEAT_INTERVAL = 30000;
// Backpressure: disconnect slow clients to avoid memory growth
const MAX_BUFFERED_AMOUNT = 512 * 1024; // 512 KB

// Load Protobuf schema
const root = protobuf.loadSync("trade.proto");
const TradeSignal = root.lookupType("TradeSignal");

// --- WebSocket Server optimized for 10K+ concurrent connections ---
const wss = new WebSocket.Server({
  port: 8080,
  perMessageDeflate: false,             // Disable compression — saves CPU at scale
  maxPayload: 1024,                      // Trade signals are tiny, limit payload size
  backlog: 2048,                         // TCP backlog queue for burst connections
  clientTracking: true                   // Required for wss.clients iteration
});

let connectionCount = 0;

console.log(`Worker Server started on ws://127.0.0.1:8080`);

// --- Ping/Pong Heartbeat to prune dead connections ---
const heartbeat = setInterval(() => {
  let pruned = 0;
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      pruned++;
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  });
  if (pruned > 0) {
    console.log(`Pruned ${pruned} dead connections`);
  }
}, HEARTBEAT_INTERVAL);

wss.on('close', () => {
  clearInterval(heartbeat);
});

// --- Subscribe to Redis channel ---
redis.subscribe(redisChannel, (err) => {
  if (err) {
    console.error("Failed to subscribe: %s", err.message);
  } else {
    console.log(`Subscribed to ${redisChannel}`);
  }
});

// --- Broadcast: Binary to browsers, JSON to MT5 ---
// Pre-allocate JSON string once per message, not per client
redis.on('messageBuffer', (channel, messageBuffer) => {
  const clientCount = wss.clients.size;
  if (clientCount === 0) return;        // Skip if no clients connected

  let jsonString = null;                // Lazy decode for MT5 only

  wss.clients.forEach((client) => {
    if (client.readyState !== WebSocket.OPEN) return;
    // Drop slow clients to keep broadcast latency and memory stable
    if (client.bufferedAmount > MAX_BUFFERED_AMOUNT) {
      client.terminate();
      return;
    }

    if (client.clientType === 'mt5') {
      if (!jsonString) {
        const decoded = TradeSignal.decode(messageBuffer);
        jsonString = JSON.stringify(TradeSignal.toObject(decoded));
      }
      client.send(jsonString);
    } else {
      // Send raw binary buffer — zero-copy, no serialization overhead
      client.send(messageBuffer);
    }
  });
});

// --- Handle new connections ---
wss.on('connection', (ws) => {
  connectionCount++;
  ws.isAlive = true;
  ws.clientType = 'browser';

  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'mt5') {
        ws.clientType = 'mt5';
      }
    } catch (e) {
      // Not JSON, ignore
    }
  });

  ws.on('close', () => {
    connectionCount--;
  });

  // Log milestone connections
  if (connectionCount % 1000 === 0 || connectionCount <= 5) {
    console.log(`Connections: ${connectionCount}`);
  }
});

// --- Graceful shutdown ---
process.on('SIGINT', () => {
  console.log('Shutting down...');
  clearInterval(heartbeat);
  wss.close(() => {
    redis.disconnect();
    process.exit(0);
  });
});
