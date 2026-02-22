#!/usr/bin/env python3
"""Stop backend + frontend local processes started in non-Docker mode."""

import subprocess
from pathlib import Path


SCRIPT_DIR = Path(__file__).parent
BACKEND_STOP_PS1 = SCRIPT_DIR / "stop-backend-local.ps1"


def run():
    if BACKEND_STOP_PS1.exists():
        subprocess.run(
            [
                "powershell",
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
                str(BACKEND_STOP_PS1),
            ],
            check=False,
        )

    # Stop any running Next.js dev process.
    subprocess.run(
        [
            "powershell",
            "-NoProfile",
            "-Command",
            "$ErrorActionPreference='SilentlyContinue'; "
            "Get-CimInstance Win32_Process | Where-Object { "
            "$_.Name -eq 'node.exe' -and "
            "$_.CommandLine -match 'next[\\\\/]dist[\\\\/]bin[\\\\/]next' -and "
            "$_.CommandLine -match 'dev' "
            "} | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }",
        ],
        check=False,
    )

    print("Stopped non-Docker backend/frontend processes (if running).")


if __name__ == "__main__":
    run()
