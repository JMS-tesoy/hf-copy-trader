# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

High-frequency copy trading platform with real-time WebSocket communication using Protocol Buffers for low-latency binary serialization.

## Architecture

**Monorepo with two independent packages** (`backend/` and `frontend/`), each with their own `package.json`. No shared workspace tooling — install dependencies separately in each directory.

**Data flow:**
1. `broker-api.js` (Express, port 4000) receives trade signals via `POST /api/trade`
2. Encodes to Protobuf binary, publishes to Redis channel `channel:global_trades`
3. `worker-server.js` (ws, port 8080) subscribes to Redis, broadcasts binary to all WebSocket clients
4. Frontend `useTradeSocket` hook decodes Protobuf and renders real-time updates

**Key infrastructure:** Redis (127.0.0.1:6379, forced IPv4 to avoid Windows IPv6 issues)

## Commands

### Frontend (`frontend/`)
```bash
npm run dev      # Next.js dev server (port 3000)
npm run build    # Production build
npm run start    # Production server
npm run lint     # ESLint
```

### Backend (`backend/`)
```bash
node broker-api.js       # Start REST API (port 4000)
node worker-server.js    # Start WebSocket server (port 8080)
node test-swarm.js       # Load test: 1000 concurrent WebSocket connections
pm2 start ecosystem.config.js  # Start all services (3 worker instances + 1 API)
```

## Tech Stack

- **Frontend:** Next.js 16, React 18, TypeScript (strict), TailwindCSS 3, protobufjs 7
- **Backend:** Express 5, ws 8, ioredis 5, protobufjs 8 (Node.js, plain JS)
- **Process management:** PM2 (worker-server runs 3 cluster instances, broker-api runs 1 fork instance)

## Critical Implementation Details

- **Protobuf schema** is defined in `backend/trade.proto` AND duplicated as inline JSON in `frontend/src/lib/useTradeSocket.ts`. Changes must be synced in both places.
- **WebSocket binary mode:** Frontend must set `binaryType = 'arraybuffer'`. Backend must use the `messageBuffer` event (not `message`) to preserve binary data integrity.
- **Trade signal schema:** `{ master_id: int32, symbol: string, action: "BUY"|"SELL", price: double }`
- **Frontend path alias:** `@/*` maps to `./src/*`
- Frontend `page.tsx` uses `'use client'` directive — it's a client component.
