"""Services-level app package forwarding to services/ai/app."""
import os
import sys

_cur = os.path.dirname(os.path.abspath(__file__))
_ai_app = os.path.join(os.path.dirname(_cur), "ai", "app")
if os.path.isdir(_ai_app) and _ai_app not in __path__:
    __path__.append(_ai_app)
