//+------------------------------------------------------------------+
//|                                               TradeReceiver.mq5  |
//|                   Copier EA — receives signals via lws2mql WS    |
//|   v2: Handles BUY, SELL, CLOSE_BUY, CLOSE_SELL, MODIFY signals  |
//+------------------------------------------------------------------+
#property copyright "CopyTrader"
#property version   "2.00"
#property strict

#include <Trade\Trade.mqh>
#include "..\Include\Websocket.mqh"
#include "..\Include\JSONParser.mqh"

//--- Input Parameters
input string   WSHost       = "127.0.0.1";  // WebSocket server host
input int      WSPort       = 8080;         // WebSocket server port
input double   LotSize      = 0.01;         // Trade lot size
input int      Slippage     = 10;           // Max slippage (points)
input int      MagicNumber  = 123456;       // EA magic number
input int      PollMs       = 100;          // WS poll interval (ms)
input int      DupeWindowSec = 5;           // Duplicate filter window (seconds)

//--- WebSocket
CWebsocket g_ws;
bool       g_connected = false;

//--- Trade execution
CTrade     g_trade;

//--- Position mapping: master signal → local ticket
struct PositionMap
{
   int    masterID;
   string symbol;
   string action;   // "BUY" or "SELL" (the opening action)
   ulong  localTicket;
};
PositionMap g_posMap[];
int         g_posMapCount = 0;

//--- Duplicate filter
struct RecentSignal
{
   int      masterID;
   string   symbol;
   string   action;
   datetime time;
};
RecentSignal g_recent[];
int          g_recentCount = 0;

//+------------------------------------------------------------------+
//| Expert initialization                                             |
//+------------------------------------------------------------------+
int OnInit()
{
   Print("TradeReceiver v2: Starting...");
   Print("TradeReceiver: WS=", WSHost, ":", WSPort,
         " Lot=", LotSize, " Magic=", MagicNumber);

   // Configure trade object
   g_trade.SetExpertMagicNumber(MagicNumber);
   g_trade.SetDeviationInPoints(Slippage);
   g_trade.SetTypeFilling(ORDER_FILLING_IOC);

   // Initialize WebSocket
   g_ws.Init();

   // Connect
   ConnectWS();

   // Poll timer
   EventSetMillisecondTimer(PollMs);

   return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
//| Expert deinitialization                                           |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();

   if(g_connected)
   {
      g_ws.ClientDisconnect();
      g_connected = false;
   }
   g_ws.Deinit();

   Print("TradeReceiver: Stopped. Reason=", reason);
}

//+------------------------------------------------------------------+
//| Timer — poll WebSocket for incoming signals                      |
//+------------------------------------------------------------------+
void OnTimer()
{
   if(!g_connected)
   {
      ConnectWS();
      return;
   }

   // Read incoming messages
   string msg = "";
   while(g_ws.ReadString(msg))
   {
      if(StringLen(msg) > 0)
      {
         ProcessSignal(msg);
      }
   }
}

//+------------------------------------------------------------------+
//| Connect to WebSocket server                                       |
//+------------------------------------------------------------------+
void ConnectWS()
{
   int ret = g_ws.ClientConnect(WSHost, WSPort);

   if(ret < 0)
   {
      Print("TradeReceiver: WS connect failed: ", g_ws.GetError());
      g_connected = false;
      return;
   }

   g_connected = true;
   Print("TradeReceiver: WS connected to ", WSHost, ":", WSPort);

   // Identify as MT5 client so server sends JSON instead of Protobuf
   string initMsg = "{\"type\":\"mt5\"}";
   g_ws.Send(initMsg);
   Print("TradeReceiver: Sent MT5 handshake");
}

//+------------------------------------------------------------------+
//| Process incoming JSON trade signal                                |
//+------------------------------------------------------------------+
void ProcessSignal(string &json)
{
   CJSONObject parser;

   if(!parser.Parse(json))
   {
      Print("TradeReceiver: Failed to parse JSON: ", json);
      return;
   }

   // Extract fields
   int    masterID = parser.GetInt("master_id", 0);
   string symbol   = parser.GetString("symbol", "");
   string action   = parser.GetString("action", "");
   double price    = parser.GetDouble("price", 0);
   long   ticket   = parser.GetLong("ticket", 0);
   double sl       = parser.GetDouble("sl", 0);
   double tp       = parser.GetDouble("tp", 0);

   if(symbol == "" || action == "")
   {
      Print("TradeReceiver: Invalid signal, missing symbol/action");
      return;
   }

   Print("TradeReceiver: Signal received: ",
         action, " ", symbol, " @ ", price,
         " from Master #", masterID,
         " ticket=", ticket, " sl=", sl, " tp=", tp);

   // Duplicate check
   if(IsDuplicate(masterID, symbol, action))
   {
      Print("TradeReceiver: Duplicate signal filtered");
      return;
   }

   // Route by action type
   if(action == "BUY" || action == "SELL")
   {
      ExecuteOpen(masterID, symbol, action, price);
   }
   else if(action == "CLOSE_BUY" || action == "CLOSE_SELL")
   {
      ExecuteClose(masterID, symbol, action);
   }
   else if(action == "MODIFY")
   {
      ExecuteModify(masterID, symbol, sl, tp);
   }
   else
   {
      Print("TradeReceiver: Unknown action: ", action);
      return;
   }

   // Record for duplicate filtering
   AddRecent(masterID, symbol, action);
}

//+------------------------------------------------------------------+
//| Execute OPEN trade (BUY or SELL)                                  |
//+------------------------------------------------------------------+
void ExecuteOpen(int masterID, string symbol, string action, double signalPrice)
{
   // Ensure symbol is available in Market Watch
   if(!SymbolSelect(symbol, true))
   {
      Print("TradeReceiver: Symbol ", symbol, " not available");
      return;
   }

   // Small delay for symbol data to load
   Sleep(100);

   // Get current prices
   double ask = SymbolInfoDouble(symbol, SYMBOL_ASK);
   double bid = SymbolInfoDouble(symbol, SYMBOL_BID);

   if(ask == 0 || bid == 0)
   {
      Print("TradeReceiver: No price data for ", symbol);
      return;
   }

   // Normalize lot size
   double minLot  = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MIN);
   double maxLot  = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MAX);
   double lotStep = SymbolInfoDouble(symbol, SYMBOL_VOLUME_STEP);
   double lot     = MathMax(minLot, MathMin(maxLot, LotSize));
   lot = MathFloor(lot / lotStep) * lotStep;

   // Use comment to tag position for later identification
   string comment = "CT:" + IntegerToString(masterID);

   bool result = false;

   if(action == "BUY")
      result = g_trade.Buy(lot, symbol, ask, 0, 0, comment);
   else if(action == "SELL")
      result = g_trade.Sell(lot, symbol, bid, 0, 0, comment);

   if(result)
   {
      ulong localTicket = g_trade.ResultOrder();
      Print("TradeReceiver: EXECUTED ", action, " ", lot, " ",
            symbol, " @ ", (action == "BUY" ? ask : bid),
            " localTicket=", localTicket);

      // Save mapping for close/modify
      AddPositionMap(masterID, symbol, action, localTicket);
   }
   else
   {
      Print("TradeReceiver: ORDER FAILED ", action, " ", symbol,
            " Error=", GetLastError(),
            " RetCode=", g_trade.ResultRetcode(),
            " Comment=", g_trade.ResultComment());
   }
}

//+------------------------------------------------------------------+
//| Execute CLOSE trade                                               |
//+------------------------------------------------------------------+
void ExecuteClose(int masterID, string symbol, string action)
{
   // CLOSE_BUY means close a BUY position, CLOSE_SELL means close a SELL
   string openAction = (action == "CLOSE_BUY") ? "BUY" : "SELL";

   // Try to find via position map first
   ulong localTicket = FindLocalTicket(masterID, symbol, openAction);

   if(localTicket > 0 && PositionSelectByTicket(localTicket))
   {
      if(g_trade.PositionClose(localTicket))
      {
         Print("TradeReceiver: CLOSED ", openAction, " ", symbol,
               " localTicket=", localTicket, " (via map)");
         RemovePositionMap(localTicket);
         return;
      }
      else
      {
         Print("TradeReceiver: Close failed for ticket ", localTicket,
               " Error=", GetLastError(), " RetCode=", g_trade.ResultRetcode());
      }
   }

   // Fallback: scan all positions by magic + symbol + comment
   string commentTag = "CT:" + IntegerToString(masterID);
   long   posType = (openAction == "BUY") ? POSITION_TYPE_BUY : POSITION_TYPE_SELL;

   int total = PositionsTotal();
   for(int i = total - 1; i >= 0; i--)
   {
      ulong t = PositionGetTicket(i);
      if(t == 0) continue;
      if(!PositionSelectByTicket(t)) continue;

      if(PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
      if(PositionGetString(POSITION_SYMBOL) != symbol) continue;
      if(PositionGetInteger(POSITION_TYPE) != posType) continue;

      // Check comment for master ID match
      string posComment = PositionGetString(POSITION_COMMENT);
      if(StringFind(posComment, commentTag) < 0) continue;

      if(g_trade.PositionClose(t))
      {
         Print("TradeReceiver: CLOSED ", openAction, " ", symbol,
               " localTicket=", t, " (via scan)");
         RemovePositionMap(t);
         return;
      }
   }

   Print("TradeReceiver: No matching position to close for ",
         openAction, " ", symbol, " master=", masterID);
}

//+------------------------------------------------------------------+
//| Execute MODIFY (SL/TP update)                                     |
//+------------------------------------------------------------------+
void ExecuteModify(int masterID, string symbol, double sl, double tp)
{
   string commentTag = "CT:" + IntegerToString(masterID);
   bool   found = false;

   int total = PositionsTotal();
   for(int i = 0; i < total; i++)
   {
      ulong t = PositionGetTicket(i);
      if(t == 0) continue;
      if(!PositionSelectByTicket(t)) continue;

      if(PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
      if(PositionGetString(POSITION_SYMBOL) != symbol) continue;

      string posComment = PositionGetString(POSITION_COMMENT);
      if(StringFind(posComment, commentTag) < 0) continue;

      // Modify SL/TP
      if(g_trade.PositionModify(t, sl, tp))
      {
         Print("TradeReceiver: MODIFIED ", symbol, " ticket=", t,
               " SL=", sl, " TP=", tp);
         found = true;
      }
      else
      {
         Print("TradeReceiver: Modify failed ticket=", t,
               " Error=", GetLastError(),
               " RetCode=", g_trade.ResultRetcode());
      }
   }

   if(!found)
   {
      Print("TradeReceiver: No matching position to modify for ",
            symbol, " master=", masterID);
   }
}

//+------------------------------------------------------------------+
//| Position map management                                           |
//+------------------------------------------------------------------+
void AddPositionMap(int masterID, string symbol, string action, ulong localTicket)
{
   g_posMapCount++;
   ArrayResize(g_posMap, g_posMapCount);
   g_posMap[g_posMapCount - 1].masterID    = masterID;
   g_posMap[g_posMapCount - 1].symbol      = symbol;
   g_posMap[g_posMapCount - 1].action      = action;
   g_posMap[g_posMapCount - 1].localTicket = localTicket;
}

ulong FindLocalTicket(int masterID, string symbol, string action)
{
   for(int i = 0; i < g_posMapCount; i++)
   {
      if(g_posMap[i].masterID == masterID &&
         g_posMap[i].symbol == symbol &&
         g_posMap[i].action == action)
      {
         return g_posMap[i].localTicket;
      }
   }
   return 0;
}

void RemovePositionMap(ulong localTicket)
{
   for(int i = 0; i < g_posMapCount; i++)
   {
      if(g_posMap[i].localTicket == localTicket)
      {
         g_posMap[i] = g_posMap[g_posMapCount - 1];
         g_posMapCount--;
         ArrayResize(g_posMap, g_posMapCount);
         return;
      }
   }
}

//+------------------------------------------------------------------+
//| Duplicate filter                                                   |
//+------------------------------------------------------------------+
bool IsDuplicate(int masterID, string symbol, string action)
{
   datetime now = TimeCurrent();

   for(int i = g_recentCount - 1; i >= 0; i--)
   {
      // Expired entries
      if(now - g_recent[i].time > DupeWindowSec) continue;

      if(g_recent[i].masterID == masterID &&
         g_recent[i].symbol == symbol &&
         g_recent[i].action == action)
      {
         return true;
      }
   }
   return false;
}

void AddRecent(int masterID, string symbol, string action)
{
   // Clean old entries
   CleanRecent();

   g_recentCount++;
   ArrayResize(g_recent, g_recentCount);
   g_recent[g_recentCount - 1].masterID = masterID;
   g_recent[g_recentCount - 1].symbol   = symbol;
   g_recent[g_recentCount - 1].action   = action;
   g_recent[g_recentCount - 1].time     = TimeCurrent();
}

void CleanRecent()
{
   datetime now = TimeCurrent();
   int newCount = 0;

   for(int i = 0; i < g_recentCount; i++)
   {
      if(now - g_recent[i].time <= DupeWindowSec * 2)
      {
         if(i != newCount)
            g_recent[newCount] = g_recent[i];
         newCount++;
      }
   }

   g_recentCount = newCount;
   ArrayResize(g_recent, g_recentCount);
}
//+------------------------------------------------------------------+
