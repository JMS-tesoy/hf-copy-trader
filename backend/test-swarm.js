const WebSocket = require('ws');
const protobuf = require('protobufjs');

// --- Configuration ---
const CLIENTS_COUNT = parseInt(process.argv[2]) || 10000;
const BATCH_SIZE = 500;                   // Connect 500 at a time to avoid EMFILE
const BATCH_DELAY = 200;                  // 200ms between batches
const SERVER_URL = 'ws://127.0.0.1:80';

// Load Protobuf
const root = protobuf.loadSync("trade.proto");
const TradeSignal = root.lookupType("TradeSignal");

let connected = 0;
let failed = 0;
let messagesReceived = 0;
let firstMessageTime = null;
let lastMessageTime = null;
const startTime = Date.now();

console.log(`Spawning ${CLIENTS_COUNT} concurrent WebSocket clients...`);
console.log(`Batch size: ${BATCH_SIZE} | Batch delay: ${BATCH_DELAY}ms\n`);

function createClient(index) {
  const ws = new WebSocket(SERVER_URL, {
    perMessageDeflate: false,
    skipUTF8Validation: true
  });
  ws.binaryType = 'arraybuffer';

  ws.on('open', () => {
    connected++;
    if (connected % 1000 === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`  Connected: ${connected}/${CLIENTS_COUNT} (${elapsed}s)`);
    }
    if (connected === CLIENTS_COUNT) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`\nAll ${CLIENTS_COUNT} clients connected in ${elapsed}s`);
      console.log(`Failed: ${failed}`);
      console.log(`\nWaiting for trade signals... (send a trade via the API)\n`);
    }
  });

  ws.on('message', (data) => {
    messagesReceived++;
    if (!firstMessageTime) {
      firstMessageTime = Date.now();
      const trade = TradeSignal.decode(new Uint8Array(data));
      console.log(`First message received: ${trade.action} ${trade.symbol} @ ${trade.price}`);
    }
    lastMessageTime = Date.now();

    // Print stats after all clients received the broadcast
    if (messagesReceived % connected === 0) {
      const broadcastTime = lastMessageTime - firstMessageTime;
      const totalMessages = messagesReceived;
      console.log(`Broadcast to ${connected} clients in ${broadcastTime}ms | Total messages: ${totalMessages}`);
      firstMessageTime = null;
    }
  });

  ws.on('error', () => {
    failed++;
  });
}

// --- Batch connection to avoid overwhelming the OS ---
async function connectAll() {
  for (let batch = 0; batch < CLIENTS_COUNT; batch += BATCH_SIZE) {
    const end = Math.min(batch + BATCH_SIZE, CLIENTS_COUNT);
    for (let i = batch; i < end; i++) {
      createClient(i);
    }
    if (end < CLIENTS_COUNT) {
      await new Promise(r => setTimeout(r, BATCH_DELAY));
    }
  }
}

connectAll();

// --- Print stats every 10 seconds ---
setInterval(() => {
  console.log(`[Stats] Connected: ${connected} | Failed: ${failed} | Messages: ${messagesReceived}`);
}, 10000);
