# MT5 Expert Advisors — Installation Guide

## Prerequisites

- MetaTrader 5 (Build 2000+)
- Backend running:
  - **Docker** (recommended): `docker-compose up -d --build`
  - **PM2** (development): `cd backend && npx pm2 start ecosystem.config.js`
- Services:
  - Nginx load balancer on port **80** (routes WebSocket connections)
  - broker-api on port **4000** (receives HTTP POST from TradeSender)
  - Redis & PostgreSQL (internal only)

## File Setup

### 1. Find your MT5 Data Folder

In MetaTrader 5: **File > Open Data Folder** — this opens a path like:
```
C:\Users\<YOU>\AppData\Roaming\MetaQuotes\Terminal\<HASH>\MQL5\
```

### 2. Copy EA files

```
mt5\Experts\TradeSender.mq5   → MQL5\Experts\TradeSender.mq5
mt5\Experts\TradeReceiver.mq5 → MQL5\Experts\TradeReceiver.mq5
mt5\Include\JSONParser.mqh     → MQL5\Include\JSONParser.mqh
```

### 3. Download lws2mql (for TradeReceiver only)

Download from: https://github.com/krisn/lws2mql

Copy these files:
```
lws2mql\MQL5\Include\Websocket.mqh      → MQL5\Include\Websocket.mqh
lws2mql\MQL5\Libraries\lws2mql.dll      → MQL5\Libraries\lws2mql.dll
lws2mql\lib\libwebsockets.dll           → MQL5\Libraries\libwebsockets.dll
```

### 4. Compile in MetaEditor

Open MetaEditor (F4 in MT5), then open and compile:
1. `TradeSender.mq5` — should compile with 0 errors
2. `TradeReceiver.mq5` — should compile with 0 errors

## MT5 Permissions

### TradeSender (HTTP)

1. **Tools > Options > Expert Advisors**
2. Check **"Allow WebRequest for listed URL"**
3. Add: `http://127.0.0.1:4000` (or your server URL)
4. Check **"Allow Algo Trading"**

### TradeReceiver (WebSocket DLL)

1. **Tools > Options > Expert Advisors**
2. Check **"Allow DLL imports"**
3. Check **"Allow Algo Trading"**

## Usage

### TradeSender (attach to any chart)

The EA monitors your MT5 account for new positions. When you open a trade (manually or via another EA), it sends the signal to the backend.

**Inputs:**
| Parameter | Default | Description |
|-----------|---------|-------------|
| ServerURL | http://127.0.0.1:4000 | Broker API endpoint |
| MasterID | 1 | Your master trader ID |
| PollMs | 500 | Position check interval (ms) |

### TradeReceiver (attach to any chart)

The EA connects to the Nginx load-balanced WebSocket server and auto-executes incoming trade signals. The Nginx load balancer distributes connections across 3 sharded workers for scalability.

**Inputs:**
| Parameter | Default | Description |
|-----------|---------|-------------|
| WSHost | 127.0.0.1 | WebSocket server host (Nginx LB) |
| WSPort | 80 | WebSocket server port (Nginx port, not direct worker) |
| LotSize | 0.01 | Trade size per signal |
| Slippage | 10 | Max slippage (points) |
| MagicNumber | 123456 | EA magic number |
| PollMs | 100 | WS message poll interval (ms) |
| DupeWindowSec | 5 | Ignore duplicate signals within N seconds |

## Architecture

```
TradeSender (Master EA)
       │
       │ HTTP POST
       ▼
   broker-api (port 4000)
   hash(master_id % 3)
       │
       ├──────────────────┬──────────────────┬──────────────────┐
       ▼                  ▼                  ▼
Redis channel:shard_0  channel:shard_1  channel:shard_2
       │                  │                  │
   worker-0:8081      worker-1:8082      worker-2:8083
       │                  │                  │
       └──────────────────┼──────────────────┘
                          │
                      Nginx LB (port 80)
                      least_conn routing
                          │
                  TradeReceiver (Follower EA)
                  WebSocket connection
```

**Flow:**
1. Master EA sends trade via HTTP POST → broker-api:4000
2. broker-api hashes master_id → publishes to shard channel (Redis)
3. Worker shard broadcasts to all followers on that shard
4. Nginx load balances followers across 3 shards (least_conn algorithm)
5. Each shard handles ~5,300 concurrent followers (16,000 total ÷ 3)

## Troubleshooting

| Issue | Solution |
|-------|----------|
| **WebRequest error 4014** (TradeSender) | Add `http://127.0.0.1:4000` to Tools > Options > Expert Advisors > Allowed URLs |
| **DLL import error** (TradeReceiver) | Enable "Allow DLL imports" in Tools > Options > Expert Advisors |
| **WebSocket connection timeout** (TradeReceiver) | Ensure Nginx is running; check firewall port 80 is open |
| **No trades executing** | Check "Allow Algo Trading" is enabled (green icon in MT5 toolbar) |
| **Symbol not found** | The trade symbol must exist in your broker's Market Watch window |
| **TradeReceiver not receiving trades** | Verify WSPort is **80** (not 8080); Nginx must be routing correctly |
| **Master trades not distributed evenly** | Check `master_id` is unique for each master trader (affects hashing) |
| **High latency/lag** | If on single server: normal for 16,000 users. For production: scale to multiple VPS with load balancing |
