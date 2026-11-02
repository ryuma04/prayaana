"""Services-level entrypoint forwarding to services/ai/app/main.py.
Allows `uvicorn app.main:app` to run when Root Directory is set to services/ on Render.
"""
import os
import sys

_cur = os.path.dirname(os.path.abspath(__file__))
_services = os.path.dirname(_cur)
_root = os.path.dirname(_services)
_services_ai = os.path.join(_services, "ai")

for p in (_services_ai, _services, _root):
    if p not in sys.path:
        sys.path.insert(0, p)

from services.ai.app.main import app, create_app

__all__ = ["app", "create_app"]
