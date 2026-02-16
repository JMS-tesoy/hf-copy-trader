//+------------------------------------------------------------------+
//|                                                 TradeSender.mq5  |
//|                           Master EA — sends trades to broker-api |
//|     Monitors positions: opens, closes, and SL/TP modifications   |
//+------------------------------------------------------------------+
#property copyright "CopyTrader"
#property version   "2.00"
#property strict

#include <Trade\Trade.mqh>

//--- Input Parameters
input string   ServerURL   = "http://127.0.0.1:4000"; // Broker API URL
input string   ApiKey      = "YOUR_API_KEY_HERE";      // Master's unique API key
input int      MasterID    = 1;                        // Master trader ID
input int      PollMs      = 500;                      // Poll interval (ms)

//--- Track known positions to detect new ones
ulong    g_knownTickets[];
int      g_knownCount = 0;
datetime g_lastCheck  = 0;

//--- Track SL/TP for modification detection
struct PositionState
{
   ulong  ticket;
   double sl;
   double tp;
};
PositionState g_posStates[];
int           g_posStateCount = 0;

//+------------------------------------------------------------------+
//| Expert initialization                                             |
//+------------------------------------------------------------------+
int OnInit()
{
   Print("TradeSender v2: Starting on ", ServerURL);
   Print("TradeSender: MasterID=", MasterID);
   Print("TradeSender: Add ", ServerURL, " to Tools > Options > Expert Advisors > Allow WebRequest for listed URL");

   // Snapshot current positions so we don't re-send existing ones
   SnapshotPositions();

   // Timer for polling
   EventSetMillisecondTimer(PollMs);

   return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
//| Expert deinitialization                                           |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();
   Print("TradeSender: Stopped. Reason=", reason);
}

//+------------------------------------------------------------------+
//| Timer event — poll for new/closed positions and SL/TP changes    |
//+------------------------------------------------------------------+
void OnTimer()
{
   CheckForNewPositions();
   CheckForClosedPositions();
   CheckForModifications();
}

//+------------------------------------------------------------------+
//| Also check on every tick for faster detection                     |
//+------------------------------------------------------------------+
void OnTick()
{
   datetime now = TimeCurrent();
   if(now == g_lastCheck) return;
   g_lastCheck = now;

   CheckForNewPositions();
   CheckForClosedPositions();
   CheckForModifications();
}

//+------------------------------------------------------------------+
//| Trade transaction — instant detection for opens and closes        |
//+------------------------------------------------------------------+
void OnTradeTransaction(const MqlTradeTransaction &trans,
                        const MqlTradeRequest &request,
                        const MqlTradeResult &result)
{
   if(trans.type != TRADE_TRANSACTION_DEAL_ADD)
      return;

   ulong positionTicket = trans.position;
   if(positionTicket == 0)
      return;

   // --- Position OPENED ---
   if(trans.deal_entry == DEAL_ENTRY_IN || trans.deal_entry == DEAL_ENTRY_INOUT)
   {
      if(IsKnownTicket(positionTicket))
         return;

      if(!PositionSelectByTicket(positionTicket))
         return;

      string symbol = PositionGetString(POSITION_SYMBOL);
      double price  = PositionGetDouble(POSITION_PRICE_OPEN);
      long   type   = PositionGetInteger(POSITION_TYPE);

      string action = (type == POSITION_TYPE_BUY) ? "BUY" : "SELL";

      bool sent = SendSignal(symbol, action, price, positionTicket, 0, 0);
      if(sent)
         Print("TradeSender: SENT ", action, " ", symbol, " @ ", price, " [ticket:", positionTicket, "]");

      AddKnownTicket(positionTicket);
      SavePositionState(positionTicket);
   }

   // --- Position CLOSED ---
   if(trans.deal_entry == DEAL_ENTRY_OUT)
   {
      if(!IsKnownTicket(positionTicket))
         return;

      string symbol = trans.symbol;
      double price  = trans.price;
      long   type   = trans.deal_type;

      // Close of a BUY position = CLOSE_BUY, close of SELL = CLOSE_SELL
      string action = (type == DEAL_TYPE_SELL) ? "CLOSE_BUY" : "CLOSE_SELL";

      bool sent = SendSignal(symbol, action, price, positionTicket, 0, 0);
      if(sent)
         Print("TradeSender: SENT ", action, " ", symbol, " @ ", price, " [ticket:", positionTicket, "]");

      RemoveKnownTicket(positionTicket);
      RemovePositionState(positionTicket);
   }
}

//+------------------------------------------------------------------+
//| Snapshot all current open positions into known list               |
//+------------------------------------------------------------------+
void SnapshotPositions()
{
   g_knownCount = PositionsTotal();
   ArrayResize(g_knownTickets, g_knownCount);
   g_posStateCount = g_knownCount;
   ArrayResize(g_posStates, g_posStateCount);

   for(int i = 0; i < g_knownCount; i++)
   {
      ulong ticket = PositionGetTicket(i);
      g_knownTickets[i] = ticket;

      if(PositionSelectByTicket(ticket))
      {
         g_posStates[i].ticket = ticket;
         g_posStates[i].sl = PositionGetDouble(POSITION_SL);
         g_posStates[i].tp = PositionGetDouble(POSITION_TP);
      }
   }

   Print("TradeSender: Snapshot ", g_knownCount, " existing positions");
}

//+------------------------------------------------------------------+
//| Check for new positions (polling fallback)                       |
//+------------------------------------------------------------------+
void CheckForNewPositions()
{
   int total = PositionsTotal();

   for(int i = 0; i < total; i++)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0) continue;
      if(IsKnownTicket(ticket)) continue;

      if(!PositionSelectByTicket(ticket)) continue;

      string symbol = PositionGetString(POSITION_SYMBOL);
      double price  = PositionGetDouble(POSITION_PRICE_OPEN);
      long   type   = PositionGetInteger(POSITION_TYPE);
      string action = (type == POSITION_TYPE_BUY) ? "BUY" : "SELL";

      bool sent = SendSignal(symbol, action, price, ticket, 0, 0);
      if(sent)
         Print("TradeSender: SENT ", action, " ", symbol, " @ ", price, " [ticket:", ticket, "]");

      AddKnownTicket(ticket);
      SavePositionState(ticket);
   }
}

//+------------------------------------------------------------------+
//| Check for closed positions (polling fallback)                    |
//+------------------------------------------------------------------+
void CheckForClosedPositions()
{
   for(int i = g_knownCount - 1; i >= 0; i--)
   {
      ulong ticket = g_knownTickets[i];
      if(PositionSelectByTicket(ticket))
         continue; // Still open

      // Position was closed — send close signal
      // We need to look up the deal history to get details
      if(HistorySelectByPosition(ticket))
      {
         int totalDeals = HistoryDealsTotal();
         for(int d = totalDeals - 1; d >= 0; d--)
         {
            ulong dealTicket = HistoryDealGetTicket(d);
            long dealEntry = HistoryDealGetInteger(dealTicket, DEAL_ENTRY);

            if(dealEntry == DEAL_ENTRY_OUT)
            {
               string symbol = HistoryDealGetString(dealTicket, DEAL_SYMBOL);
               double price  = HistoryDealGetDouble(dealTicket, DEAL_PRICE);
               long   dealType = HistoryDealGetInteger(dealTicket, DEAL_TYPE);

               string action = (dealType == DEAL_TYPE_SELL) ? "CLOSE_BUY" : "CLOSE_SELL";

               bool sent = SendSignal(symbol, action, price, ticket, 0, 0);
               if(sent)
                  Print("TradeSender: SENT ", action, " ", symbol, " @ ", price, " [closed ticket:", ticket, "]");
               break;
            }
         }
      }

      RemoveKnownTicket(ticket);
      RemovePositionState(ticket);
   }
}

//+------------------------------------------------------------------+
//| Check for SL/TP modifications                                    |
//+------------------------------------------------------------------+
void CheckForModifications()
{
   for(int i = 0; i < g_posStateCount; i++)
   {
      ulong ticket = g_posStates[i].ticket;
      if(!PositionSelectByTicket(ticket)) continue;

      double currentSL = PositionGetDouble(POSITION_SL);
      double currentTP = PositionGetDouble(POSITION_TP);

      if(MathAbs(currentSL - g_posStates[i].sl) > 0.00001 ||
         MathAbs(currentTP - g_posStates[i].tp) > 0.00001)
      {
         string symbol = PositionGetString(POSITION_SYMBOL);
         double price  = PositionGetDouble(POSITION_PRICE_OPEN);

         bool sent = SendSignal(symbol, "MODIFY", price, ticket, currentSL, currentTP);
         if(sent)
            Print("TradeSender: SENT MODIFY ", symbol, " SL=", currentSL, " TP=", currentTP);

         g_posStates[i].sl = currentSL;
         g_posStates[i].tp = currentTP;
      }
   }
}

//+------------------------------------------------------------------+
//| Known ticket management                                          |
//+------------------------------------------------------------------+
bool IsKnownTicket(ulong ticket)
{
   for(int i = 0; i < g_knownCount; i++)
      if(g_knownTickets[i] == ticket) return true;
   return false;
}

void AddKnownTicket(ulong ticket)
{
   g_knownCount++;
   ArrayResize(g_knownTickets, g_knownCount);
   g_knownTickets[g_knownCount - 1] = ticket;
}

void RemoveKnownTicket(ulong ticket)
{
   for(int i = 0; i < g_knownCount; i++)
   {
      if(g_knownTickets[i] == ticket)
      {
         g_knownTickets[i] = g_knownTickets[g_knownCount - 1];
         g_knownCount--;
         ArrayResize(g_knownTickets, g_knownCount);
         return;
      }
   }
}

//+------------------------------------------------------------------+
//| Position state (SL/TP) management                                |
//+------------------------------------------------------------------+
void SavePositionState(ulong ticket)
{
   if(!PositionSelectByTicket(ticket)) return;

   g_posStateCount++;
   ArrayResize(g_posStates, g_posStateCount);
   g_posStates[g_posStateCount - 1].ticket = ticket;
   g_posStates[g_posStateCount - 1].sl = PositionGetDouble(POSITION_SL);
   g_posStates[g_posStateCount - 1].tp = PositionGetDouble(POSITION_TP);
}

void RemovePositionState(ulong ticket)
{
   for(int i = 0; i < g_posStateCount; i++)
   {
      if(g_posStates[i].ticket == ticket)
      {
         g_posStates[i] = g_posStates[g_posStateCount - 1];
         g_posStateCount--;
         ArrayResize(g_posStates, g_posStateCount);
         return;
      }
   }
}

//+------------------------------------------------------------------+
//| Send signal via HTTP POST to broker-api                          |
//+------------------------------------------------------------------+
bool SendSignal(string symbol, string action, double price,
                ulong ticket, double sl, double tp)
{
   string url = ServerURL + "/api/trade";

   // Build JSON payload
   string json = "{"
      + "\"master_id\":" + IntegerToString(MasterID) + ","
      + "\"symbol\":\"" + symbol + "\","
      + "\"action\":\"" + action + "\","
      + "\"price\":" + DoubleToString(price, 5) + ","
      + "\"ticket\":" + IntegerToString((long)ticket);

   if(sl > 0) json += ",\"sl\":" + DoubleToString(sl, 5);
   if(tp > 0) json += ",\"tp\":" + DoubleToString(tp, 5);
   json += "}";

   // Prepare request
   char   postData[];
   char   result[];
   string headers = "Content-Type: application/json\r\n";
   if(StringLen(ApiKey) > 0)
      headers += "X-API-Key: " + ApiKey + "\r\n";
   string resultHeaders;
   int    timeout = 5000;

   StringToCharArray(json, postData, 0, WHOLE_ARRAY, CP_UTF8);
   ArrayResize(postData, ArraySize(postData) - 1);

   ResetLastError();

   int statusCode = WebRequest(
      "POST", url, headers, timeout,
      postData, result, resultHeaders
   );

   if(statusCode == -1)
   {
      int err = GetLastError();
      Print("TradeSender: WebRequest error ", err,
            ". Make sure ", ServerURL, " is in allowed URLs list.");
      return false;
   }

   if(statusCode == 200)
      return true;

   string response = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
   Print("TradeSender: HTTP ", statusCode, " - ", response);
   return false;
}
//+------------------------------------------------------------------+
