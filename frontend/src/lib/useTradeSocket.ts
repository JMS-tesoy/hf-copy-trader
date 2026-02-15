import { useEffect, useRef, useState, useCallback } from 'react';
import protobuf from 'protobufjs';

// 1. Define the Protocol (JSON format is safer for Browser than loading .proto files)
const protoJSON = {
  "nested": {
    "TradeSignal": {
      "fields": {
        "master_id": { "type": "int32", "id": 1 },
        "symbol": { "type": "string", "id": 2 },
        "action": { "type": "string", "id": 3 },
        "price": { "type": "double", "id": 4 }
      }
    }
  }
};

// 2. Load the Translator
const root = protobuf.Root.fromJSON(protoJSON);
const TradeSignal = root.lookupType("TradeSignal");

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

const WS_URL = 'ws://127.0.0.1:8080';
const RECONNECT_DELAY = 3000;

export const useTradeSocket = (onTrade: (trade: any) => void) => {
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const onTradeRef = useRef(onTrade);
  onTradeRef.current = onTrade;

  const connect = useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN) return;

    setStatus('connecting');

    // 3. Connect to the "Worker" Backend
    const ws = new WebSocket(WS_URL);

    // IMPORTANT: Tell browser to receive Binary, not Text
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
      console.log('🟢 Connected to Trading Engine');
      setStatus('connected');
    };

    ws.onmessage = (event) => {
      try {
        // 4. Decode the Binary Signal
        const buffer = new Uint8Array(event.data as ArrayBuffer);
        const message = TradeSignal.decode(buffer);
        const trade = TradeSignal.toObject(message);

        // 5. Send to UI
        onTradeRef.current(trade);
      } catch (err) {
        console.error("Decode Error:", err);
      }
    };

    ws.onclose = () => {
      console.log('🔴 Disconnected from Trading Engine');
      setStatus('disconnected');
      // Auto-reconnect after delay
      reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY);
    };

    ws.onerror = () => {
      setStatus('disconnected');
    };

    socketRef.current = ws;
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      socketRef.current?.close();
    };
  }, [connect]);

  return { socketRef, status };
};
