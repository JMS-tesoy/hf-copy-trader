#!/usr/bin/env python3
"""Stop Docker services + frontend dev server."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from start import cmd_stop

cmd_stop(None)
