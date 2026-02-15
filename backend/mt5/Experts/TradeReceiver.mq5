//+------------------------------------------------------------------+
//|                                               TradeReceiver.mq5  |
//|                   Copier EA — receives signals via lws2mql WS    |
//|              Connects to worker-server, parses JSON, executes    |
//+------------------------------------------------------------------+
#property copyright "CopyTrader"
#property version   "1.00"
#property strict

#include <Trade\Trade.mqh>
#include "..\\Include\\Websocket.mqh"
#include "..\\Include\\JSONParser.mqh"

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
   Print("TradeReceiver: Starting...");
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

   if(symbol == "" || action == "")
   {
      Print("TradeReceiver: Invalid signal, missing symbol/action");
      return;
   }

   Print("TradeReceiver: Signal received: ",
         action, " ", symbol, " @ ", price,
         " from Master #", masterID);

   // Duplicate check
   if(IsDuplicate(masterID, symbol, action))
   {
      Print("TradeReceiver: Duplicate signal filtered");
      return;
   }

   // Execute the trade
   ExecuteTrade(symbol, action, price);

   // Record for duplicate filtering
   AddRecent(masterID, symbol, action);
}

//+------------------------------------------------------------------+
//| Execute a trade based on signal                                   |
//+------------------------------------------------------------------+
void ExecuteTrade(string symbol, string action, double signalPrice)
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

   bool result = false;

   if(action == "BUY")
   {
      result = g_trade.Buy(lot, symbol, ask, 0, 0,
               "CopyTrader Recv");
   }
   else if(action == "SELL")
   {
      result = g_trade.Sell(lot, symbol, bid, 0, 0,
               "CopyTrader Recv");
   }
   else
   {
      Print("TradeReceiver: Unknown action: ", action);
      return;
   }

   if(result)
   {
      Print("TradeReceiver: EXECUTED ", action, " ", lot, " ",
            symbol, " @ ", (action == "BUY" ? ask : bid));
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
//| Check for duplicate signal within time window                     |
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

//+------------------------------------------------------------------+
//| Add signal to recent list                                         |
//+------------------------------------------------------------------+
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

//+------------------------------------------------------------------+
//| Remove expired entries from recent list                           |
//+------------------------------------------------------------------+
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
