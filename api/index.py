"""
Vercel serverless function entry-point.

Vercel detects this file as a Python serverless function and routes all
/api/* requests to it via the vercel.json rewrite.  The FastAPI app is
imported from the backend package; we need to ensure Python can resolve
the backend's internal absolute imports (``from middleware.auth import …``,
``from config.settings import …``, etc.) by placing the ``backend/``
directory on sys.path **before** the import happens.
"""

import os
import sys

# ── Path setup ────────────────────────────────────────────────────────
# Project root  → makes ``import backend.api.main`` work.
# backend/      → makes the backend's own ``from middleware.auth …`` work.
_project_root = os.path.join(os.path.dirname(__file__), "..")
_backend_root = os.path.join(_project_root, "backend")

for _p in (_backend_root, _project_root):
    _abs = os.path.abspath(_p)
    if _abs not in sys.path:
        sys.path.insert(0, _abs)

# ── Import the FastAPI application ────────────────────────────────────
from backend.api.main import app  # noqa: E402, F401

# Vercel expects the ASGI app to be importable from this module as ``app``.
