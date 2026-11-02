import sys
from pathlib import Path

# Ensure services/ai is on sys.path
SERVICES_AI = Path(__file__).resolve().parents[1]
if str(SERVICES_AI) not in sys.path:
    sys.path.insert(0, str(SERVICES_AI))

