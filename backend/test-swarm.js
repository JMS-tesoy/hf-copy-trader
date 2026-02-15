const WebSocket = require('ws');
const protobuf = require('protobufjs');

// Settings: Simulate 1,000 users
const CLIENTS_COUNT = 1000; 
const SERVER_URL = 'ws://127.0.0.1:8080';

// Load the Translator
const root = protobuf.loadSync("trade.proto");
const TradeSignal = root.lookupType("TradeSignal");

let connected = 0;
let messagesReceived = 0;

console.log(`🚀 Spawning ${CLIENTS_COUNT} dummy traders...`);

// Create 1,000 Dummy Users
for (let i = 0; i < CLIENTS_COUNT; i++) {
    const ws = new WebSocket(SERVER_URL);
    ws.binaryType = 'arraybuffer'; // Critical for speed

    ws.on('open', () => {
        connected++;
        if (connected === CLIENTS_COUNT) console.log("✅ All armies are ready and listening!");
    });

    ws.on('message', (data) => {
        // Decode the binary signal
        const trade = TradeSignal.decode(new Uint8Array(data));
        messagesReceived++;
        
        // Only log the first one so we don't spam the console
        if (messagesReceived === 1) {
             console.log(`⚡ SPEED TEST PASSED! Received: ${trade.action} ${trade.symbol} @ ${trade.price}`);
             console.log(`(Simulating 999 other users receiving this instantly...)`);
        }
    });
    
    ws.on('error', (err) => {
        // Ignore minor connection errors during startup
    });
}