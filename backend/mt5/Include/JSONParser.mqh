//+------------------------------------------------------------------+
//|                                                  JSONParser.mqh  |
//|                        Minimal JSON parser for flat trade signals |
//|                     Parses: {"key":"val","key2":123}             |
//+------------------------------------------------------------------+
#property copyright "CopyTrader"
#property strict

//+------------------------------------------------------------------+
//| JSONValue — holds a single parsed value                          |
//+------------------------------------------------------------------+
struct JSONValue
{
   string key;
   string stringVal;
   double doubleVal;
   bool   isNumber;
};

//+------------------------------------------------------------------+
//| JSONObject — flat key-value store parsed from JSON string         |
//+------------------------------------------------------------------+
class CJSONObject
{
private:
   JSONValue m_values[];
   int       m_count;

   // Skip whitespace
   int SkipWS(const string &json, int pos)
   {
      int len = StringLen(json);
      while(pos < len)
      {
         ushort ch = StringGetCharacter(json, pos);
         if(ch != ' ' && ch != '\t' && ch != '\n' && ch != '\r')
            break;
         pos++;
      }
      return pos;
   }

   // Extract quoted string, returns position after closing quote
   int ParseString(const string &json, int pos, string &result)
   {
      result = "";
      int len = StringLen(json);
      if(pos >= len || StringGetCharacter(json, pos) != '"')
         return -1;
      pos++; // skip opening quote
      int start = pos;
      while(pos < len)
      {
         ushort ch = StringGetCharacter(json, pos);
         if(ch == '\\' && pos + 1 < len)
         {
            pos += 2; // skip escaped char
            continue;
         }
         if(ch == '"')
         {
            result = StringSubstr(json, start, pos - start);
            return pos + 1; // skip closing quote
         }
         pos++;
      }
      return -1;
   }

   // Parse a number value
   int ParseNumber(const string &json, int pos, double &result)
   {
      int len = StringLen(json);
      int start = pos;
      while(pos < len)
      {
         ushort ch = StringGetCharacter(json, pos);
         if((ch >= '0' && ch <= '9') || ch == '.' || ch == '-' || ch == '+' || ch == 'e' || ch == 'E')
            pos++;
         else
            break;
      }
      if(pos == start) return -1;
      result = StringToDouble(StringSubstr(json, start, pos - start));
      return pos;
   }

public:
   CJSONObject() : m_count(0) {}

   //--- Parse a flat JSON object string
   bool Parse(const string &json)
   {
      m_count = 0;
      ArrayResize(m_values, 0);

      int len = StringLen(json);
      int pos = SkipWS(json, 0);

      // Expect opening brace
      if(pos >= len || StringGetCharacter(json, pos) != '{')
         return false;
      pos++;

      while(pos < len)
      {
         pos = SkipWS(json, pos);
         if(pos >= len) return false;

         // Check for end of object
         if(StringGetCharacter(json, pos) == '}')
            return true;

         // Skip comma between pairs
         if(StringGetCharacter(json, pos) == ',')
         {
            pos++;
            pos = SkipWS(json, pos);
         }

         // Parse key
         string key;
         pos = ParseString(json, pos, key);
         if(pos < 0) return false;

         // Skip colon
         pos = SkipWS(json, pos);
         if(pos >= len || StringGetCharacter(json, pos) != ':')
            return false;
         pos++;
         pos = SkipWS(json, pos);

         // Parse value
         JSONValue val;
         val.key = key;
         val.isNumber = false;
         val.doubleVal = 0;
         val.stringVal = "";

         ushort ch = StringGetCharacter(json, pos);
         if(ch == '"')
         {
            // String value
            pos = ParseString(json, pos, val.stringVal);
            if(pos < 0) return false;
         }
         else
         {
            // Number value
            val.isNumber = true;
            pos = ParseNumber(json, pos, val.doubleVal);
            if(pos < 0) return false;
         }

         m_count++;
         ArrayResize(m_values, m_count);
         m_values[m_count - 1] = val;
      }

      return false; // No closing brace found
   }

   //--- Get string value by key
   string GetString(const string key, const string defaultVal = "")
   {
      for(int i = 0; i < m_count; i++)
      {
         if(m_values[i].key == key)
            return m_values[i].isNumber
               ? DoubleToString(m_values[i].doubleVal, 8)
               : m_values[i].stringVal;
      }
      return defaultVal;
   }

   //--- Get integer value by key
   int GetInt(const string key, int defaultVal = 0)
   {
      for(int i = 0; i < m_count; i++)
      {
         if(m_values[i].key == key)
            return m_values[i].isNumber
               ? (int)m_values[i].doubleVal
               : (int)StringToInteger(m_values[i].stringVal);
      }
      return defaultVal;
   }

   //--- Get double value by key
   double GetDouble(const string key, double defaultVal = 0.0)
   {
      for(int i = 0; i < m_count; i++)
      {
         if(m_values[i].key == key)
            return m_values[i].isNumber
               ? m_values[i].doubleVal
               : StringToDouble(m_values[i].stringVal);
      }
      return defaultVal;
   }

   //--- Check if key exists
   bool HasKey(const string key)
   {
      for(int i = 0; i < m_count; i++)
         if(m_values[i].key == key) return true;
      return false;
   }
};
