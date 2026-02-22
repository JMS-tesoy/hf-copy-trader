#!/usr/bin/env python3
"""Start backend + frontend locally without Docker."""

import subprocess
import sys
from pathlib import Path


SCRIPT_DIR = Path(__file__).parent
START_NO_DOCKER_PS1 = SCRIPT_DIR / "start-local-nodocker.ps1"


def run():
    if not START_NO_DOCKER_PS1.exists():
        print(f"Missing script: {START_NO_DOCKER_PS1}")
        sys.exit(1)

    print("Starting local no-Docker stack...")
    subprocess.run(
        [
            "powershell",
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            str(START_NO_DOCKER_PS1),
        ],
        check=True,
    )


if __name__ == "__main__":
    run()
