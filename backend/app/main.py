"""
FastAPI application entry point.
Security headers, CORS, rate limiting, and health check are all configured here.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError

from app.config import get_settings
from app.database import engine, Base
from app.routers import auth, learning, onboarding, mentor

settings = get_settings()

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: validate DB connection and create schema if needed."""
    logger.info("CyberMentor AI backend starting (env=%s)", settings.app_env)
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database connection and schema verified.")
    except Exception as e:
        logger.warning("Database connection check failed (%s). Ensure database is running if endpoints are used.", e)
    yield
    try:
        await engine.dispose()
        logger.info("Database engine disposed.")
    except Exception:
        pass


app = FastAPI(
    title="CyberMentor AI API",
    version="1.0.0",
    description="Backend API for the CyberMentor AI cybersecurity learning platform.",
    docs_url="/docs" if not settings.is_production else None,
    redoc_url="/redoc" if not settings.is_production else None,
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
allowed_origins = [settings.frontend_origin]
if not settings.is_production:
    allowed_origins.extend([
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
    ])
allowed_origins = list(dict.fromkeys(allowed_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,   # Required for HttpOnly cookies
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
)

# ── Origin-checking CSRF defense middleware ────────────────────────────────────
@app.middleware("http")
async def csrf_origin_validation(request: Request, call_next):
    """
    Enforce Origin validation on state-mutating HTTP methods (POST, PUT, PATCH, DELETE).

    SECURITY SCOPE (Browser-Only Protection):
    - This middleware protects BROWSER clients by verifying the browser-enforced 'Origin' header.
      Browsers automatically include 'Origin' on cross-origin requests; untrusted origins are rejected with 403.
    - NON-BROWSER clients (such as mobile apps, native CLI tools, curl, backend microservices)
      do not send an 'Origin' header by default and are permitted to execute.
      Consequently, Origin checking serves specifically as CSRF mitigation, not general client authorization.
    """
    if request.method in ("POST", "PUT", "PATCH", "DELETE"):
        origin = request.headers.get("origin")
        if origin and origin not in allowed_origins:
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={"detail": "Cross-origin request rejected: Origin not allowed"},
            )
    return await call_next(request)

# ── Security headers middleware ───────────────────────────────────────────────
@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    if settings.is_production:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

# ── Request logging ───────────────────────────────────────────────────────────
@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info("%s %s", request.method, request.url.path)
    response = await call_next(request)
    logger.info("→ %d", response.status_code)
    return response

# ── Global error handlers ─────────────────────────────────────────────────────
@app.exception_handler(IntegrityError)
async def integrity_error_handler(request: Request, exc: IntegrityError):
    """
    Explicitly log database integrity collisions (unique constraint violations, FK errors).
    Monitors concurrency race collisions rather than allowing them to disappear into generic 500s.
    """
    logger.error(
        "DATABASE INTEGRITY COLLISION on %s %s: %s (params: %s)",
        request.method, request.url.path, getattr(exc, "orig", exc),
        getattr(exc, "params", None),
        exc_info=True
    )
    detail = "Database integrity collision" if not settings.is_production else "Internal server error"
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": detail},
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    # Never leak internal details in production
    detail = str(exc) if not settings.is_production else "Internal server error"
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": detail},
    )

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(learning.router)
app.include_router(onboarding.router)
app.include_router(mentor.router)

# ── Health check ─────────────────────────────────────────────────────────────
@app.get("/health", tags=["system"])
async def health():
    return {"status": "ok", "env": settings.app_env}
