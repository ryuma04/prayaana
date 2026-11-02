"""Root entrypoint forwarding to services/ai/app/main.py.
Allows `uvicorn app.main:app` to run directly from repository root on Render/Docker.
"""
import os
import sys

_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_services_ai = os.path.join(_root, "services", "ai")

if _services_ai not in sys.path:
    sys.path.insert(0, _services_ai)
if _root not in sys.path:
    sys.path.insert(1, _root)

from services.ai.app.main import app, create_app

__all__ = ["app", "create_app"]
