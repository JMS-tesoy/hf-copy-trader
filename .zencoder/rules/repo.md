---
description: Repository Information Overview
alwaysApply: true
---

# Copy Trading Platform Repository Information Overview

## Repository Summary
A high-frequency copy trading platform featuring real-time trade signal distribution using Protocol Buffers and WebSockets. The system supports MT4/MT5 integration through custom Expert Advisors (EAs).

## Repository Structure
- **backend/**: Node.js server handling trade signals via Express and broadcasting via WebSockets.
- **frontend/**: Next.js dashboard for real-time trade monitoring and administration.
- **backend/EA's/**: MetaTrader 4 and MetaTrader 5 Expert Advisors for sending and receiving trades.

### Main Repository Components
- **Broker API (Backend)**: Receives trade signals from MT4/MT5 via HTTP POST.
- **Worker Server (Backend)**: Broadcasts trade signals to all connected WebSocket clients.
- **Monitoring Dashboard (Frontend)**: Real-time UI for viewing trade signals and platform status.
- **Expert Advisors (MT4/MT5)**: Bridge between trading terminals and the Node.js backend.

## Projects

### Backend (Node.js)
**Configuration File**: `backend/package.json`, `backend/ecosystem.config.js`

#### Language & Runtime
**Language**: JavaScript (Node.js)  
**Version**: Node.js 20+ (suggested by types)  
**Build System**: NPM  
**Package Manager**: npm

#### Dependencies
**Main Dependencies**:
- `express`: REST API framework (port 4000)
- `ws`: WebSocket server for real-time distribution (port 8080)
- `ioredis`: Redis client for PubSub communication
- `protobufjs`: Protocol Buffers for binary serialization
- `pg`: PostgreSQL client for trade logging
- `pm2`: Process management for clustering and stability

#### Build & Installation
```bash
cd backend
npm install
node broker-api.js & node worker-server.js
# Or using PM2
pm2 start ecosystem.config.js
```

#### Docker
No Docker configuration found in the repository.

#### Testing
**Framework**: Custom Load Testing
**Test Location**: `backend/test-swarm.js`
**Run Command**:
```bash
node backend/test-swarm.js
```

### Frontend (Next.js UI)
**Configuration File**: `frontend/package.json`, `frontend/tsconfig.json`

#### Language & Runtime
**Language**: TypeScript  
**Version**: Next.js 16, React 18  
**Build System**: Next.js Build  
**Package Manager**: npm

#### Dependencies
**Main Dependencies**:
- `next`: React framework
- `react`: UI library
- `lightweight-charts`: Financial charting
- `protobufjs`: Binary decoding for WebSocket signals
- `lucide-react`: Icon library
- `tailwind-merge`: CSS utility

#### Build & Installation
```bash
cd frontend
npm install
npm run dev
```

#### Testing
**Framework**: ESLint (Validation)
**Run Command**:
```bash
npm run lint
```

### MetaTrader Integration (EAs)
**Type**: MQL4/MQL5 Trading Scripts

#### Specification & Tools
**Type**: MQL4, MQL5  
**Required Tools**: MetaTrader 4/5 Terminal, MetaEditor, lws2mql (WebSocket DLL)

#### Key Resources
**Main Files**:
- `backend/EA's/MT5/TradeSender/TradeSender.mq5`: Sends trades from MT5 to Backend.
- `backend/EA's/MT5/TradeReceiver/TradeReceiver.mq5`: Executes trades received from Backend.
- `backend/trade.proto`: Shared Protocol Buffer definition.

#### Usage & Operations
**Integration Points**:
- **HTTP**: TradeSender sends signals to `http://127.0.0.1:4000/api/trade`.
- **WebSocket**: TradeReceiver listens on `ws://127.0.0.1:8080`.
- **Redis**: Backend components communicate via Redis PubSub on `127.0.0.1:6379`.
