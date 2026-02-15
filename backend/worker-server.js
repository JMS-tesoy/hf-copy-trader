require('dotenv').config();
const WebSocket = require('ws');
const Redis = require('ioredis');
const protobuf = require('protobufjs');

// --- FIX 1: Force IPv4 connection ---
const redis = new Redis({
  host: "127.0.0.1",
  port: 6379
});

const redisChannel = 'channel:global_trades';

// Heartbeat interval (30 seconds)
const HEARTBEAT_INTERVAL = 30000;

// Load Protobuf for decoding binary -> JSON (for MT5 clients)
const root = protobuf.loadSync("trade.proto");
const TradeSignal = root.lookupType("TradeSignal");

// Start WebSocket Server on Port 8080
const wss = new WebSocket.Server({ port: 8080 });

console.log(`🚀 Worker Server started on ws://127.0.0.1:8080`);

// --- Ping/Pong Heartbeat to prune dead connections ---
const heartbeat = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      console.log('🧹 Terminating dead connection');
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  });
}, HEARTBEAT_INTERVAL);

wss.on('close', () => {
  clearInterval(heartbeat);
});

// 1. Subscribe to the "Radio Channel"
redis.subscribe(redisChannel, (err, count) => {
  if (err) {
    console.error("❌ Failed to subscribe: %s", err.message);
  } else {
    console.log(`✅ Subscribed to ${redisChannel}`);
  }
});

// --- FIX 2: LISTEN FOR BINARY DATA ---
// We use 'messageBuffer' instead of 'message'.
// 'message' returns a string (corrupts Protobuf).
// 'messageBuffer' returns a raw Buffer (keeps Protobuf safe).
redis.on('messageBuffer', (channel, messageBuffer) => {

  // Decode once for MT5 JSON clients
  let jsonString = null;

  wss.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN) {
      if (client.clientType === 'mt5') {
        // MT5 clients get JSON text (lws2mql handles text, not Protobuf)
        if (!jsonString) {
          const decoded = TradeSignal.decode(messageBuffer);
          jsonString = JSON.stringify(TradeSignal.toObject(decoded));
        }
        client.send(jsonString);
      } else {
        // Frontend clients get raw binary Protobuf
        client.send(messageBuffer);
      }
    }
  });
});

// Handle new connections — MT5 clients identify themselves
wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.clientType = 'browser'; // default

  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'mt5') {
        ws.clientType = 'mt5';
        console.log('📡 MT5 client connected');
      }
    } catch (e) {
      // Not JSON, ignore
    }
  });
});
