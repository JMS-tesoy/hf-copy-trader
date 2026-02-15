//+------------------------------------------------------------------+
//|                                                 TradeSender.mq5  |
//|                           Master EA — sends trades to broker-api |
//|          Monitors account positions and POSTs new ones via HTTP  |
//+------------------------------------------------------------------+
#property copyright "CopyTrader"
#property version   "1.00"
#property strict

#include <Trade\Trade.mqh>

//--- Input Parameters
input string   ServerURL   = "http://127.0.0.1:4000"; // Broker API URL
input int      MasterID    = 1;                        // Master trader ID
input int      PollMs      = 500;                      // Poll interval (ms)

//--- Track known positions to detect new ones
int      g_knownTickets[];
int      g_knownCount = 0;
datetime g_lastCheck  = 0;

//+------------------------------------------------------------------+
//| Expert initialization                                             |
//+------------------------------------------------------------------+
int OnInit()
{
   // Allow WebRequest to our server
   Print("TradeSender: Starting on ", ServerURL);
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
//| Timer event — poll for new positions                              |
//+------------------------------------------------------------------+
void OnTimer()
{
   CheckForNewPositions();
}

//+------------------------------------------------------------------+
//| Also check on every tick for faster detection                     |
//+------------------------------------------------------------------+
void OnTick()
{
   // Throttle: don't check more than once per PollMs
   datetime now = TimeCurrent();
   if(now == g_lastCheck) return;
   g_lastCheck = now;

   CheckForNewPositions();
}

//+------------------------------------------------------------------+
//| Snapshot all current open positions into known list               |
//+------------------------------------------------------------------+
void SnapshotPositions()
{
   g_knownCount = PositionsTotal();
   ArrayResize(g_knownTickets, g_knownCount);

   for(int i = 0; i < g_knownCount; i++)
   {
      ulong ticket = PositionGetTicket(i);
      g_knownTickets[i] = (int)ticket;
   }

   Print("TradeSender: Snapshot ", g_knownCount, " existing positions");
}

//+------------------------------------------------------------------+
//| Check for new positions and send them                             |
//+------------------------------------------------------------------+
void CheckForNewPositions()
{
   int total = PositionsTotal();

   for(int i = 0; i < total; i++)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0) continue;

      // Skip if already known
      if(IsKnownTicket((int)ticket)) continue;

      // New position detected — read its details
      if(!PositionSelectByTicket(ticket)) continue;

      string symbol = PositionGetString(POSITION_SYMBOL);
      double price  = PositionGetDouble(POSITION_PRICE_OPEN);
      long   type   = PositionGetInteger(POSITION_TYPE);

      string action = (type == POSITION_TYPE_BUY) ? "BUY" : "SELL";

      // Send to backend
      bool sent = SendTradeSignal(symbol, action, price);

      if(sent)
         Print("TradeSender: SENT ", action, " ", symbol, " @ ", price, " [ticket:", ticket, "]");
      else
         Print("TradeSender: FAILED to send ", action, " ", symbol);

      // Add to known list regardless (avoid spam on failure)
      AddKnownTicket((int)ticket);
   }
}

//+------------------------------------------------------------------+
//| Check if ticket is in our known list                              |
//+------------------------------------------------------------------+
bool IsKnownTicket(int ticket)
{
   for(int i = 0; i < g_knownCount; i++)
   {
      if(g_knownTickets[i] == ticket) return true;
   }
   return false;
}

//+------------------------------------------------------------------+
//| Add ticket to known list                                          |
//+------------------------------------------------------------------+
void AddKnownTicket(int ticket)
{
   g_knownCount++;
   ArrayResize(g_knownTickets, g_knownCount);
   g_knownTickets[g_knownCount - 1] = ticket;
}

//+------------------------------------------------------------------+
//| Send trade signal via HTTP POST to broker-api                     |
//+------------------------------------------------------------------+
bool SendTradeSignal(string symbol, string action, double price)
{
   string url = ServerURL + "/api/trade";

   // Build JSON payload
   string json = "{"
      + "\"master_id\":" + IntegerToString(MasterID) + ","
      + "\"symbol\":\"" + symbol + "\","
      + "\"action\":\"" + action + "\","
      + "\"price\":" + DoubleToString(price, 5)
      + "}";

   // Prepare request
   char   postData[];
   char   result[];
   string headers = "Content-Type: application/json\r\n";
   string resultHeaders;
   int    timeout = 5000; // 5 second timeout

   StringToCharArray(json, postData, 0, WHOLE_ARRAY, CP_UTF8);
   // Remove null terminator that StringToCharArray adds
   ArrayResize(postData, ArraySize(postData) - 1);

   ResetLastError();

   int statusCode = WebRequest(
      "POST",
      url,
      headers,
      timeout,
      postData,
      result,
      resultHeaders
   );

   if(statusCode == -1)
   {
      int err = GetLastError();
      Print("TradeSender: WebRequest error ", err,
            ". Make sure ", ServerURL, " is in allowed URLs list.");
      return false;
   }

   if(statusCode == 200)
   {
      return true;
   }
   else
   {
      string response = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
      Print("TradeSender: HTTP ", statusCode, " - ", response);
      return false;
   }
}
//+------------------------------------------------------------------+
