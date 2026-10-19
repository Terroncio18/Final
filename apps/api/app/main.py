"""IgnisLab API.

Monitorització de focus actius i dades de suport per al simulador de propagació.
Eina educativa i divulgativa: no és un sistema operatiu de predicció.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

VERSION = "0.1.0"

# The Vite dev server. In production the frontend is served from the same origin,
# so this list only matters while developing.
DEV_ORIGINS = ("http://localhost:5173", "http://127.0.0.1:5173")

app = FastAPI(
    title="IgnisLab · API",
    version=VERSION,
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(DEV_ORIGINS),
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/api/v1/health")
def health() -> dict[str, str]:
    """Liveness check, and the first thing the frontend calls on load."""
    return {"status": "ok", "version": VERSION}
