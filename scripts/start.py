#!/usr/bin/env python3
"""
Copy Trading Platform - Dev Script
Replaces: run-local, stop-local, check-user, sync-db-from-docker (.ps1 + .bat)

Usage:
  python scripts/dev.py start
  python scripts/dev.py stop
  python scripts/dev.py check-user --email user@example.com
  python scripts/dev.py sync-db [--force]
"""

import argparse
import os
import socket
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

# ── Paths ──────────────────────────────────────────────────────────────────────
SCRIPT_DIR   = Path(__file__).parent
REPO_ROOT    = SCRIPT_DIR.parent
BACKEND_DIR  = REPO_ROOT / "backend"
FRONTEND_DIR = REPO_ROOT / "frontend"

# ── Colors (ANSI) ──────────────────────────────────────────────────────────────
os.system("")  # enable VT100 sequences on Windows console

CYAN        = "\033[96m"
YELLOW      = "\033[93m"
GREEN       = "\033[92m"
RED         = "\033[91m"
DARK_YELLOW = "\033[33m"
RESET       = "\033[0m"

def cyan(msg):        return f"{CYAN}{msg}{RESET}"
def yellow(msg):      return f"{YELLOW}{msg}{RESET}"
def green(msg):       return f"{GREEN}{msg}{RESET}"
def red(msg):         return f"{RED}{msg}{RESET}"
def warn(msg):        print(f"{YELLOW}WARNING: {msg}{RESET}")

# ── Helpers ────────────────────────────────────────────────────────────────────

def is_port_open(port: int, host: str = "127.0.0.1", timeout: float = 0.35) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


def is_docker_ready() -> bool:
    try:
        result = subprocess.run(
            ["docker", "info"],
            capture_output=True,
            timeout=10,
        )
        return result.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


def ensure_docker_ready():
    if is_docker_ready():
        return

    print(yellow("Docker engine is not ready. Trying to open Docker Desktop..."))

    candidates = [
        Path(os.environ.get("ProgramFiles", "C:/Program Files")) / "Docker/Docker/Docker Desktop.exe",
        Path(os.environ.get("LOCALAPPDATA", "")) / "Programs/Docker/Docker/Docker Desktop.exe",
    ]

    launched = False
    for exe in candidates:
        if exe.exists():
            subprocess.Popen([str(exe)])
            launched = True
            break

    if not launched:
        print(red("Docker Desktop executable not found. Start Docker Desktop manually, then re-run."))
        sys.exit(1)

    print(yellow("Waiting for Docker engine to become ready..."))
    max_wait = 120
    elapsed  = 0
    while elapsed < max_wait:
        time.sleep(3)
        elapsed += 3
        if is_docker_ready():
            print(green("Docker is ready."))
            return

    print(red(f"Docker did not become ready within {max_wait}s. Check Docker Desktop status and retry."))
    sys.exit(1)


def docker_compose(*args):
    """Run docker-compose or docker compose, whichever is available."""
    try:
        subprocess.run(["docker-compose", "--version"], capture_output=True, check=True)
        cmd = ["docker-compose", *args]
    except (FileNotFoundError, subprocess.CalledProcessError):
        cmd = ["docker", "compose", *args]
    subprocess.run(cmd, cwd=REPO_ROOT)


def get_postgres_container_id() -> str | None:
    """Find the Postgres container by compose labels or name."""
    result = subprocess.run(
        [
            "docker", "ps", "-q",
            "--filter", "label=com.docker.compose.project=copy-trading-platform",
            "--filter", "label=com.docker.compose.service=postgres",
        ],
        capture_output=True, text=True,
    )
    lines = result.stdout.strip().splitlines()
    if lines:
        return lines[0]

    # Fallback: name filter
    result = subprocess.run(
        ["docker", "ps", "-q", "--filter", "name=copy-trading-platform-postgres"],
        capture_output=True, text=True,
    )
    lines = result.stdout.strip().splitlines()
    return lines[0] if lines else None


def load_env_file(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        eq = line.find("=")
        if eq < 1:
            continue
        key = line[:eq].strip()
        val = line[eq + 1:].strip()
        if val.startswith('"') and val.endswith('"') and len(val) >= 2:
            val = val[1:-1]
        env[key] = val
    return env

# ── Commands ───────────────────────────────────────────────────────────────────

def cmd_start(_args):
    print(cyan("== Copy Trading Platform: Local Launcher =="))
    print(f"Repo root: {REPO_ROOT}")

    if not (BACKEND_DIR / "node_modules").exists():
        warn("backend/node_modules is missing. Run: cd backend && npm install")
    if not (FRONTEND_DIR / "node_modules").exists():
        warn("frontend/node_modules is missing. Run: cd frontend && npm install")

    if is_port_open(4000):
        warn("Port 4000 is already in use. Stop PM2 backend to avoid conflicts.")

    ensure_docker_ready()

    print(yellow("Starting Docker services (docker-compose up -d --build)..."))
    docker_compose("up", "-d", "--build")
    docker_compose("ps")

    if not is_port_open(4000):
        warn("Backend API port 4000 is not reachable yet. Check docker logs if needed.")

    print(yellow("Starting frontend dev server in a new window..."))
    frontend_cmd = f"Set-Location -LiteralPath '{FRONTEND_DIR}'; npm run dev"
    subprocess.Popen(
        ["powershell", "-NoExit", "-Command", frontend_cmd],
        creationflags=subprocess.CREATE_NEW_CONSOLE,
    )

    print()
    print(green("Done."))
    print("Frontend:    http://localhost:3000")
    print("Backend API: http://127.0.0.1:4000")
    print("Nginx:       http://127.0.0.1")
    print()
    print("One-click stop: python scripts/dev.py stop")


def cmd_stop(_args):
    print(cyan("== Copy Trading Platform: Stop Local =="))

    print(yellow("Stopping Docker services..."))
    docker_compose("down")

    print(yellow("Stopping frontend dev server (next dev)..."))

    # Find node.exe processes running next dev via PowerShell WMI
    result = subprocess.run(
        [
            "powershell", "-NoProfile", "-Command",
            "Get-CimInstance Win32_Process | Where-Object { "
            "$_.Name -eq 'node.exe' -and "
            "$_.CommandLine -match 'next[\\\\/]dist[\\\\/]bin[\\\\/]next' -and "
            "$_.CommandLine -match 'dev' "
            "} | Select-Object -ExpandProperty ProcessId",
        ],
        capture_output=True, text=True,
    )
    pids = [p.strip() for p in result.stdout.strip().splitlines() if p.strip()]
    if pids:
        for pid in pids:
            subprocess.run(["taskkill", "/PID", pid, "/F"], capture_output=True)
        print(green(f"Stopped {len(pids)} frontend dev process(es)."))
    else:
        print(f"{DARK_YELLOW}No frontend dev process found.{RESET}")

    print(green("Done."))


def cmd_check_user(args):
    container_id = get_postgres_container_id()
    if not container_id:
        print(red("Postgres Docker container not found. Start stack first: python scripts/dev.py start"))
        sys.exit(1)

    safe_email = args.email.replace("'", "''").lower()
    sql = (
        f"select id, name, email, created_at from users "
        f"where lower(email)=lower('{safe_email}');"
    )

    print(cyan(f"Querying Docker Postgres for: {args.email}"))
    subprocess.run(
        ["docker", "exec", container_id, "psql", "-U", "postgres", "-d", "copy_trading", "-c", sql]
    )


def cmd_backup_db(_args):
    """Dump Docker Postgres to a timestamped .sql file in scripts/backups/."""
    container_id = get_postgres_container_id()
    if not container_id:
        print(red("Postgres Docker container not found. Start stack first: python scripts/start.py start"))
        sys.exit(1)

    backup_dir = SCRIPT_DIR / "backups"
    backup_dir.mkdir(exist_ok=True)
    ts   = datetime.now().strftime("%Y%m%d_%H%M%S")
    dest = backup_dir / f"copy_trading_{ts}.sql"

    print(cyan(f"Backing up Docker Postgres -> {dest}"))
    with open(dest, "wb") as f:
        result = subprocess.run(
            [
                "docker", "exec", container_id,
                "pg_dump", "-U", "postgres", "-d", "copy_trading",
                "--clean", "--if-exists", "--no-owner", "--no-privileges",
            ],
            stdout=f,
        )
    if result.returncode != 0:
        print(red("Backup failed."))
        dest.unlink(missing_ok=True)
        sys.exit(1)

    size_kb = dest.stat().st_size // 1024
    print(green(f"Backup saved: {dest} ({size_kb} KB)"))
    print("Restore with: python scripts/start.py restore-db --file <path>")


def cmd_restore_db(args):
    """Restore Docker Postgres from a .sql backup file."""
    backup_file = Path(args.file)
    if not backup_file.exists():
        print(red(f"File not found: {backup_file}"))
        sys.exit(1)

    container_id = get_postgres_container_id()
    if not container_id:
        print(red("Postgres Docker container not found. Start stack first: python scripts/start.py start"))
        sys.exit(1)

    print(yellow(f"This will OVERWRITE the Docker database with: {backup_file}"))
    confirm = input("Type RESTORE to continue: ")
    if confirm != "RESTORE":
        print(yellow("Cancelled."))
        sys.exit(0)

    print(cyan("Restoring..."))
    with open(backup_file, "rb") as f:
        result = subprocess.run(
            ["docker", "exec", "-i", container_id, "psql", "-U", "postgres", "-d", "copy_trading"],
            stdin=f,
        )
    if result.returncode != 0:
        print(red("Restore failed."))
        sys.exit(1)

    print(green("Restore complete."))


def cmd_sync_db(args):
    print(cyan("== Sync Local DB From Docker DB =="))

    # Locate .env
    env_path: Path | None = None
    for candidate in [BACKEND_DIR / ".env", REPO_ROOT / ".env"]:
        if candidate.exists():
            env_path = candidate
            break
    if not env_path:
        print(red("No .env file found (expected backend/.env or .env)."))
        sys.exit(1)

    cfg     = load_env_file(env_path)
    pg_host = cfg.get("PG_HOST",     "127.0.0.1")
    pg_port = cfg.get("PG_PORT",     "5432")
    pg_db   = cfg.get("PG_DATABASE", "copy_trading")
    pg_user = cfg.get("PG_USER",     "postgres")
    pg_pass = cfg.get("PG_PASSWORD", "")

    # Verify required CLI tools
    for tool in ["docker", "psql"]:
        if subprocess.run(["where", tool], capture_output=True).returncode != 0:
            print(red(f"Required command not found: {tool}"))
            sys.exit(1)

    container_id = get_postgres_container_id()
    if not container_id:
        print(red("Docker Postgres container not found. Start stack first: python scripts/dev.py start"))
        sys.exit(1)

    env = {**os.environ, "PGPASSWORD": pg_pass}

    # Check local DB exists
    result = subprocess.run(
        [
            "psql", "-h", pg_host, "-p", pg_port, "-U", pg_user,
            "-d", "postgres", "-tAc",
            f"SELECT 1 FROM pg_database WHERE datname='{pg_db}';",
        ],
        capture_output=True, text=True, env=env,
    )
    if result.returncode != 0:
        print(red(f"Cannot reach local Postgres at {pg_host}:{pg_port} as user {pg_user}."))
        sys.exit(1)

    if result.stdout.strip() != "1":
        print(yellow(f"Local DB '{pg_db}' does not exist. Creating..."))
        r = subprocess.run(
            ["createdb", "-h", pg_host, "-p", pg_port, "-U", pg_user, pg_db],
            env=env,
        )
        if r.returncode != 0:
            print(red(f"Failed to create local database '{pg_db}'."))
            sys.exit(1)

    if not args.force:
        print(yellow(
            f"This will OVERWRITE local database '{pg_db}' "
            f"with data from Docker container '{container_id}'."
        ))
        confirm = input("Type SYNC to continue: ")
        if confirm != "SYNC":
            print(yellow("Cancelled."))
            sys.exit(0)

    ts        = datetime.now().strftime("%Y%m%d_%H%M%S")
    temp_file = Path(os.environ.get("TEMP", "/tmp")) / f"copy_trading_sync_{ts}.sql"

    print(yellow(f"Exporting from Docker DB to {temp_file} ..."))
    with open(temp_file, "w", encoding="utf-8") as f:
        result = subprocess.run(
            [
                "docker", "exec", container_id,
                "pg_dump", "-U", "postgres", "-d", pg_db,
                "--clean", "--if-exists", "--no-owner", "--no-privileges",
            ],
            stdout=f, text=True,
        )
    if result.returncode != 0:
        print(red("Failed to dump Docker Postgres database."))
        sys.exit(1)

    # Filter PG16+ lines that older local servers may not recognise
    lines    = temp_file.read_text(encoding="utf-8").splitlines()
    filtered = [l for l in lines if not l.startswith("SET transaction_timeout = ")]
    temp_file.write_text("\n".join(filtered), encoding="utf-8")

    print(yellow(f"Importing into local DB '{pg_db}' ..."))
    result = subprocess.run(
        [
            "psql", "-v", "ON_ERROR_STOP=1",
            "-h", pg_host, "-p", pg_port, "-U", pg_user, "-d", pg_db,
            "-f", str(temp_file),
        ],
        env=env,
    )
    if result.returncode != 0:
        print(red("Failed to restore dump into local database."))
        sys.exit(1)

    temp_file.unlink(missing_ok=True)
    print(green("Sync complete. Local DB is now aligned with Docker DB."))

# ── Entry point ────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        prog="dev.py",
        description="Copy Trading Platform dev script",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("start",      help="Start Docker services + frontend dev server")
    sub.add_parser("stop",       help="Stop Docker services + frontend dev server")

    p_check = sub.add_parser("check-user", help="Query a user by email from Docker Postgres")
    p_check.add_argument("--email", required=True, help="User email to look up")

    sub.add_parser("backup-db", help="Dump Docker Postgres to scripts/backups/")

    p_restore = sub.add_parser("restore-db", help="Restore Docker Postgres from a backup file")
    p_restore.add_argument("--file", required=True, help="Path to .sql backup file")

    p_sync = sub.add_parser("sync-db", help="Sync local Postgres DB from Docker Postgres")
    p_sync.add_argument("--force", action="store_true", help="Skip confirmation prompt")

    args = parser.parse_args(args=sys.argv[1:] or ["start"])
    {
        "start":      cmd_start,
        "stop":       cmd_stop,
        "check-user": cmd_check_user,
        "backup-db":  cmd_backup_db,
        "restore-db": cmd_restore_db,
        "sync-db":    cmd_sync_db,
    }[args.command](args)


if __name__ == "__main__":
    main()
