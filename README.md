# MT5 Expert Advisors — Installation Guide

## Prerequisites

- MetaTrader 5 (Build 2000+)
- Node.js backend running (broker-api on port 4000, worker-server on port 8080)
- Redis running on 127.0.0.1:6379

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

The EA connects to the WebSocket server and auto-executes incoming trade signals.

**Inputs:**
| Parameter | Default | Description |
|-----------|---------|-------------|
| WSHost | 127.0.0.1 | WebSocket server host |
| WSPort | 8080 | WebSocket server port |
| LotSize | 0.01 | Trade size per signal |
| Slippage | 10 | Max slippage (points) |
| MagicNumber | 123456 | EA magic number |
| PollMs | 100 | WS message poll interval (ms) |
| DupeWindowSec | 5 | Ignore duplicate signals within N seconds |

## Architecture

```
┌──────────────┐    HTTP POST     ┌──────────────┐    Redis PubSub    ┌────────────────┐
│ TradeSender  │ ───────────────► │  broker-api  │ ──────────────────►│ worker-server  │
│   (MT5 EA)   │                  │  (port 4000) │                    │  (port 8080)   │
└──────────────┘                  └──────────────┘                    └───────┬────────┘
                                                                             │ WebSocket
                                                                             │ (JSON)
                                                                     ┌───────▼────────┐
                                                                     │ TradeReceiver   │
                                                                     │   (MT5 EA)      │
                                                                     └─────────────────┘
```

## Troubleshooting

- **WebRequest error 4014**: Add the URL to allowed list in Tools > Options > Expert Advisors
- **DLL import error**: Enable "Allow DLL imports" in Expert Advisors settings
- **No connection**: Ensure backend is running (`node broker-api.js` and `node worker-server.js`)
- **No trades executing**: Check "Allow Algo Trading" is enabled (green icon in toolbar)
- **Symbol not found**: The signal symbol must exist in your broker's Market Watch
