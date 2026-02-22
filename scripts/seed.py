#!/usr/bin/env python3
"""
Seed the Docker Postgres DB with realistic demo data for the landing page.

Inserts:
  - 10 master traders  (masters table)
  - 300 seed users     (users table)
  - 300 subscriptions  (subscriptions table, unevenly distributed)
  - ~200 trade signals (trade_audit_log)
  - ~200 closed trades (copied_trades, for sparkline charts)

Safe to re-run — all inserts use ON CONFLICT DO NOTHING.

Usage:
  python scripts/seed.py            # insert demo data
  python scripts/seed.py --clear    # wipe seed rows then re-insert
"""

import argparse
import os
import random
import secrets
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from start import get_postgres_container_id, cyan, green, yellow, red

# ── Config ─────────────────────────────────────────────────────────────────────
random.seed(42)           # reproducible data
DB_NAME  = "copy_trading"
DB_USER  = "postgres"
SYMBOLS  = ["EURUSD", "GBPUSD", "XAUUSD", "USDJPY", "BTCUSD", "GBPJPY", "AUDUSD"]
ACTIONS  = ["BUY", "SELL"]
NOW      = datetime.now(timezone.utc)

# ── Master definitions ─────────────────────────────────────────────────────────
MASTERS = [
    {
        "name": "James Whitfield",
        "email": "seed_james@hftrader.io",
        "bio": "15 years in institutional FX. Specialises in London session breakouts with tight risk controls.",
        "followers": 148,
        "win_rate_base": 71,
        "signals": 38,
    },
    {
        "name": "Mei Lin",
        "email": "seed_mei@hftrader.io",
        "bio": "Asian session gold and yen specialist. Consistent 3:1 risk-reward on every position.",
        "followers": 124,
        "win_rate_base": 68,
        "signals": 32,
    },
    {
        "name": "Carlos Estrada",
        "email": "seed_carlos@hftrader.io",
        "bio": "Macro-driven swing trader. Focuses on central bank divergence plays across G10 pairs.",
        "followers": 97,
        "win_rate_base": 63,
        "signals": 29,
    },
    {
        "name": "Aisha Nkemdirim",
        "email": "seed_aisha@hftrader.io",
        "bio": "Price action purist. No indicators — pure structure, order flow, and patience.",
        "followers": 81,
        "win_rate_base": 66,
        "signals": 24,
    },
    {
        "name": "Viktor Sorokin",
        "email": "seed_viktor@hftrader.io",
        "bio": "Former prop desk trader. Momentum scalping on EURUSD and GBPUSD during NY open.",
        "followers": 72,
        "win_rate_base": 59,
        "signals": 41,
    },
    {
        "name": "Priya Menon",
        "email": "seed_priya@hftrader.io",
        "bio": "Quantitative approach to trend following. Systematic entries on 4H and daily timeframes.",
        "followers": 58,
        "win_rate_base": 62,
        "signals": 22,
    },
    {
        "name": "Lucas Ferreira",
        "email": "seed_lucas@hftrader.io",
        "bio": "Crypto-correlated FX plays. Trades BTCUSD alongside USDJPY for macro hedges.",
        "followers": 47,
        "win_rate_base": 55,
        "signals": 19,
    },
    {
        "name": "Sophie Müller",
        "email": "seed_sophie@hftrader.io",
        "bio": "Fibonacci retracement specialist. Precision entries at key Fib levels with hard stops.",
        "followers": 36,
        "win_rate_base": 60,
        "signals": 17,
    },
    {
        "name": "Raj Patel",
        "email": "seed_raj@hftrader.io",
        "bio": "News-driven trader. Expert at positioning before high-impact NFP and CPI releases.",
        "followers": 24,
        "win_rate_base": 57,
        "signals": 14,
    },
    {
        "name": "Hana Kobayashi",
        "email": "seed_hana@hftrader.io",
        "bio": "Tokyo session specialist. Yen crosses and overnight gap fills with disciplined lot sizing.",
        "followers": 13,
        "win_rate_base": 52,
        "signals": 11,
    },
]

TOTAL_USERS = sum(m["followers"] for m in MASTERS)  # exactly as many users as needed


def esc(s: str) -> str:
    """Escape single quotes for SQL."""
    return s.replace("'", "''")


def ts(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%d %H:%M:%S+00")


def rand_price(symbol: str) -> str:
    prices = {
        "EURUSD": (1.05, 1.12),
        "GBPUSD": (1.24, 1.32),
        "XAUUSD": (1900, 2100),
        "USDJPY": (140, 152),
        "BTCUSD": (38000, 68000),
        "GBPJPY": (178, 195),
        "AUDUSD": (0.63, 0.69),
    }
    lo, hi = prices.get(symbol, (1.0, 2.0))
    return f"{random.uniform(lo, hi):.5f}"


def build_sql(clear: bool) -> str:
    parts = []

    if clear:
        parts.append("""
-- Wipe seed rows (identified by seed_ prefix in email)
DELETE FROM copied_trades
  WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'seed_user_%@seed.local');
DELETE FROM subscriptions
  WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'seed_user_%@seed.local');
DELETE FROM trade_audit_log
  WHERE master_id IN (SELECT id FROM masters WHERE email LIKE 'seed_%@hftrader.io');
DELETE FROM subscriptions
  WHERE master_id IN (SELECT id FROM masters WHERE email LIKE 'seed_%@hftrader.io');
DELETE FROM masters WHERE email LIKE 'seed_%@hftrader.io';
DELETE FROM users  WHERE email LIKE 'seed_user_%@seed.local';
""")

    # ── 1. Masters ─────────────────────────────────────────────────────────────
    master_rows = []
    for m in MASTERS:
        api_key = secrets.token_hex(32)
        created = ts(NOW - timedelta(days=random.randint(60, 365)))
        master_rows.append(
            f"('{esc(m['name'])}', '{api_key}', 'active', '{esc(m['email'])}', "
            f"'{esc(m['bio'])}', '{created}')"
        )

    # masters.email has no UNIQUE constraint, so ON CONFLICT won't work.
    # Use individual INSERT ... WHERE NOT EXISTS instead.
    master_inserts = []
    for row, m in zip(master_rows, MASTERS):
        cols = row[1:-1]  # strip outer parentheses for SELECT
        master_inserts.append(
            f"INSERT INTO masters (name, api_key, status, email, bio, created_at)\n"
            f"SELECT {cols}\n"
            f"WHERE NOT EXISTS (SELECT 1 FROM masters WHERE email = '{m['email']}');"
        )
    parts.append("-- Masters\n" + "\n".join(master_inserts))

    # ── 2. Users ───────────────────────────────────────────────────────────────
    user_rows = []
    for i in range(1, TOTAL_USERS + 1):
        balance = round(random.uniform(5000, 50000), 2)
        created = ts(NOW - timedelta(days=random.randint(10, 300)))
        user_rows.append(
            f"('Seed User {i}', 'seed_user_{i}@seed.local', {balance}, '{created}')"
        )

    user_values = ',\n  '.join(user_rows)
    parts.append(f"""
-- Seed users
INSERT INTO users (name, email, balance, created_at)
VALUES
  {user_values}
ON CONFLICT (email) DO NOTHING;
""")

    # ── 3. Subscriptions ───────────────────────────────────────────────────────
    # We reference masters/users by email to avoid hardcoded IDs
    sub_rows = []
    user_idx = 1
    for m in MASTERS:
        for _ in range(m["followers"]):
            win_rate  = round(random.uniform(m["win_rate_base"] - 8, m["win_rate_base"] + 8), 1)
            win_rate  = max(30.0, min(90.0, win_rate))
            trades    = random.randint(10, 120)
            profit    = round(random.uniform(-200, 2000), 2)
            created   = ts(NOW - timedelta(days=random.randint(5, 180)))
            sub_rows.append(
                f"((SELECT id FROM users WHERE email='seed_user_{user_idx}@seed.local'), "
                f"(SELECT id FROM masters WHERE email='{m['email']}'), "
                f"'active', {win_rate}, {profit}, {trades}, '{created}')"
            )
            user_idx += 1

    sub_values = ',\n  '.join(sub_rows)
    parts.append(f"""
-- Subscriptions
INSERT INTO subscriptions (user_id, master_id, status, win_rate, total_profit, total_trades, created_at)
VALUES
  {sub_values}
ON CONFLICT (user_id, master_id) DO NOTHING;
""")

    # ── 4. trade_audit_log ─────────────────────────────────────────────────────
    log_rows = []
    for m in MASTERS:
        for i in range(m["signals"]):
            symbol  = random.choice(SYMBOLS)
            action  = random.choice(ACTIONS)
            price   = rand_price(symbol)
            days_ago = random.randint(0, 90)
            secs_ago = random.randint(0, 86400)
            received = ts(NOW - timedelta(days=days_ago, seconds=secs_ago))
            log_rows.append(
                f"((SELECT id FROM masters WHERE email='{m['email']}'), "
                f"'{symbol}', '{action}', {price}, '{received}')"
            )

    log_values = ',\n  '.join(log_rows)
    parts.append(f"""
-- Trade signals (audit log)
INSERT INTO trade_audit_log (master_id, symbol, action, price, received_at)
VALUES
  {log_values};
""")

    # ── 5. copied_trades (closed) ──────────────────────────────────────────────
    trade_rows = []
    user_idx = 1
    for m in MASTERS:
        trades_per_master = 20
        for i in range(trades_per_master):
            # pick a subscriber user for this master
            sub_user = f"seed_user_{user_idx + (i % m['followers'])}@seed.local"
            symbol   = random.choice(SYMBOLS)
            action   = random.choice(ACTIONS)
            price    = rand_price(symbol)

            # win ~win_rate_base% of the time
            is_win = random.random() < (m["win_rate_base"] / 100)
            if is_win:
                profit_pips = round(random.uniform(8, 45), 1)
            else:
                profit_pips = round(random.uniform(-20, -3), 1)

            close_price = rand_price(symbol)
            days_ago    = random.randint(1, 90)
            secs_ago    = random.randint(0, 86400)
            closed_at   = ts(NOW - timedelta(days=days_ago, seconds=secs_ago))

            trade_rows.append(
                f"((SELECT id FROM users WHERE email='{sub_user}'), "
                f"(SELECT id FROM masters WHERE email='{m['email']}'), "
                f"'{symbol}', '{action}', {price}, 0.01, 'closed', "
                f"{profit_pips}, {close_price}, '{closed_at}')"
            )
        user_idx += m["followers"]

    trade_values = ',\n  '.join(trade_rows)
    parts.append(f"""
-- Closed copied trades (for performance sparklines)
INSERT INTO copied_trades
  (user_id, master_id, symbol, action, price, lot_size, status, profit_pips, close_price, closed_at)
VALUES
  {trade_values};
""")

    return "\n".join(parts)


def run_sql(container_id: str, sql: str):
    result = subprocess.run(
        ["docker", "exec", "-i", container_id,
         "psql", "-U", DB_USER, "-d", DB_NAME, "-v", "ON_ERROR_STOP=1"],
        input=sql.encode("utf-8"),   # explicit UTF-8, avoids Windows cp1252 issues
        capture_output=True,
    )
    if result.stdout:
        print(result.stdout.decode("utf-8", errors="replace"))
    if result.returncode != 0:
        print(red("SQL error:"))
        print(result.stderr.decode("utf-8", errors="replace"))
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="Seed demo data into Docker Postgres")
    parser.add_argument("--clear", action="store_true",
                        help="Wipe existing seed rows before inserting")
    args = parser.parse_args()

    print(cyan("== Copy Trading Platform: Seed Demo Data =="))

    container_id = get_postgres_container_id()
    if not container_id:
        print(red("Postgres Docker container not found. Run: python scripts/start.py"))
        sys.exit(1)

    if args.clear:
        print(yellow("--clear: wiping existing seed rows first..."))

    print(yellow("Building SQL..."))
    sql = build_sql(clear=args.clear)

    print(yellow("Inserting demo data into Docker Postgres..."))
    run_sql(container_id, sql)

    print(green("\nSeed complete! Summary:"))
    print(f"  Masters      : {len(MASTERS)}")
    print(f"  Users        : {TOTAL_USERS}")
    print(f"  Subscriptions: {TOTAL_USERS}")
    print(f"  Signals      : {sum(m['signals'] for m in MASTERS)}")
    print(f"  Closed trades: {len(MASTERS) * 20}")
    print()
    print("Refresh http://localhost:3000/landing to see the leaderboard.")


if __name__ == "__main__":
    main()
