#!/usr/bin/env python3
"""Start backend + frontend locally without Docker."""

import subprocess
import sys
from pathlib import Path


SCRIPT_DIR = Path(__file__).parent
REPO_ROOT = SCRIPT_DIR.parent
FRONTEND_DIR = REPO_ROOT / "frontend"
BACKEND_START_PS1 = SCRIPT_DIR / "start-backend-local.ps1"


def run():
    if not BACKEND_START_PS1.exists():
        print(f"Missing script: {BACKEND_START_PS1}")
        sys.exit(1)
    if not (FRONTEND_DIR / "package.json").exists():
        print(f"Missing frontend folder: {FRONTEND_DIR}")
        sys.exit(1)

    print("Starting backend locally (no Docker)...")
    subprocess.run(
        [
            "powershell",
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            str(BACKEND_START_PS1),
        ],
        check=True,
    )

    print("Starting frontend dev server...")
    frontend_cmd = f"Set-Location -LiteralPath '{FRONTEND_DIR}'; npm run dev"
    subprocess.Popen(
        ["powershell", "-NoExit", "-Command", frontend_cmd],
        creationflags=subprocess.CREATE_NEW_CONSOLE,
    )

    print("")
    print("Local non-Docker stack started:")
    print("  Frontend: http://localhost:3000")
    print("  Backend:  http://127.0.0.1:4000")
    print("")
    print("Stop backend: python scripts/stop-nodocker.py")
    print("Stop frontend: close its terminal or stop next dev process")


if __name__ == "__main__":
    run()

