"""
Authentication API router.
Rate-limited, validated, and secured.
Session management via server-side JWT tracking.
"""

import uuid
import time
from collections import defaultdict
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from jose import JWTError
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import User, UserProfile, UserSession, UserRole
from app.security import (
    hash_password, verify_password, needs_rehash,
    create_access_token, decode_token, generate_jti,
    DUMMY_HASH,
)
from app.config import get_settings

settings = get_settings()
router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

# ── Cookie names ─────────────────────────────────────────────────────────────
ACCESS_COOKIE = "access_token"
COOKIE_KWARGS = dict(httponly=True, secure=settings.is_production, samesite="lax", path="/")

# ── Brute-force Throttling ───────────────────────────────────────────────────
_LOGIN_ATTEMPTS: dict[str, list[float]] = defaultdict(list)
_MAX_LOGIN_ATTEMPTS = 10
_WINDOW_SECONDS = 60.0


def _check_rate_limit(key: str) -> None:
    now = time.time()
    _LOGIN_ATTEMPTS[key] = [t for t in _LOGIN_ATTEMPTS[key] if now - t < _WINDOW_SECONDS]
    if len(_LOGIN_ATTEMPTS[key]) >= _MAX_LOGIN_ATTEMPTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many authentication attempts. Please try again later.",
        )


def _record_failed_attempt(key: str) -> None:
    _LOGIN_ATTEMPTS[key].append(time.time())


def _reset_attempts(key: str) -> None:
    _LOGIN_ATTEMPTS.pop(key, None)


# ── Schemas ───────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one number")
        return v

    @field_validator("full_name")
    @classmethod
    def sanitize_name(cls, v: str) -> str:
        return v.strip()


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class UserOut(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    xp_total: int
    level: int
    onboarding_completed: bool

    model_config = {"from_attributes": True}


class AuthResponse(BaseModel):
    user: UserOut
    message: str


# ── Helpers ───────────────────────────────────────────────────────────────────

def _extract_token(request: Request) -> str | None:
    """Extract JWT token from HttpOnly cookie or Authorization Bearer header."""
    token = request.cookies.get(ACCESS_COOKIE)
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:].strip()
    return token


# ── Dependency: current user ──────────────────────────────────────────────────

async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Extract and validate JWT from HttpOnly cookie or Authorization Bearer header.
    Checks token signature, expiry, and server-side revocation.
    """
    token = _extract_token(request)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    try:
        payload = decode_token(token)
        user_id: str = payload.get("sub", "")
        jti: str = payload.get("jti", "")
        token_type: str = payload.get("type", "")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    if token_type != "access" or not user_id or not jti:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token claims")

    # Check server-side revocation
    session_result = await db.execute(
        select(UserSession).where(UserSession.jti == jti, UserSession.revoked_at == None)  # noqa: E711
    )
    session = session_result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session revoked or not found")

    # Load user
    try:
        user_uuid = uuid.UUID(user_id) if isinstance(user_id, str) else user_id
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid user ID format")

    user_result = await db.execute(select(User).where(User.id == user_uuid, User.is_active == True))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(
    body: RegisterRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> AuthResponse:
    """Register a new learner account."""
    # Check uniqueness (case-insensitive)
    existing = await db.execute(
        select(User).where(User.email == body.email.lower())
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    # Create user
    user = User(
        email=body.email.lower(),
        full_name=body.full_name,
        hashed_password=hash_password(body.password),
        role=UserRole.learner,
    )
    db.add(user)
    await db.flush()

    # Create empty profile
    profile = UserProfile(user_id=user.id)
    db.add(profile)
    await db.flush()

    # Issue tokens and create session
    jti = generate_jti()
    access_token, access_expires = create_access_token(str(user.id), jti)

    session = UserSession(
        user_id=user.id,
        jti=jti,
        expires_at=access_expires,
        user_agent=request.headers.get("user-agent", "")[:512],
        ip_address=_get_client_ip(request),
    )
    db.add(session)

    # Set HttpOnly cookie
    response.set_cookie(ACCESS_COOKIE, access_token, **COOKIE_KWARGS,
                        max_age=settings.access_token_expire_minutes * 60)

    return AuthResponse(
        user=_user_to_out(user, onboarding_completed=False),
        message="Account created successfully",
    )


@router.post("/login", response_model=AuthResponse)
async def login(
    body: LoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> AuthResponse:
    """Authenticate and issue session tokens with brute-force defense."""
    client_ip = _get_client_ip(request)
    email_key = body.email.lower()
    _check_rate_limit(f"ip:{client_ip}")
    _check_rate_limit(f"email:{email_key}")

    user_result = await db.execute(
        select(User).where(User.email == email_key, User.is_active == True)
    )
    user = user_result.scalar_one_or_none()

    # Constant-time: always verify against valid hash even if user not found (prevents timing attacks)
    password_ok = verify_password(body.password, user.hashed_password if user else DUMMY_HASH)

    if not user or not password_ok:
        _record_failed_attempt(f"ip:{client_ip}")
        _record_failed_attempt(f"email:{email_key}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    # Reset attempts on success
    _reset_attempts(f"email:{email_key}")

    # Rehash if parameters are outdated
    if needs_rehash(user.hashed_password):
        user.hashed_password = hash_password(body.password)

    user.last_login_at = datetime.now(timezone.utc)

    jti = generate_jti()
    access_token, access_expires = create_access_token(str(user.id), jti)

    session = UserSession(
        user_id=user.id,
        jti=jti,
        expires_at=access_expires,
        user_agent=request.headers.get("user-agent", "")[:512],
        ip_address=_get_client_ip(request),
    )
    db.add(session)

    response.set_cookie(ACCESS_COOKIE, access_token, **COOKIE_KWARGS,
                        max_age=settings.access_token_expire_minutes * 60)

    # Load profile
    profile_result = await db.execute(select(UserProfile).where(UserProfile.user_id == user.id))
    profile = profile_result.scalar_one_or_none()

    return AuthResponse(
        user=_user_to_out(user, onboarding_completed=profile.onboarding_completed if profile else False),
        message="Login successful",
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Revoke session and clear cookies. Requires active cookie or Bearer session."""
    token = _extract_token(request)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    try:
        payload = decode_token(token)
        jti = payload.get("jti", "")
        token_type = payload.get("type", "")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    if not jti or token_type != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token claims")

    session_result = await db.execute(
        select(UserSession).where(UserSession.jti == jti)
    )
    session = session_result.scalar_one_or_none()
    if session:
        session.revoked_at = datetime.now(timezone.utc)

    response.delete_cookie(ACCESS_COOKIE, path="/")


@router.get("/me", response_model=UserOut)
async def get_me(current_user: CurrentUser, db: AsyncSession = Depends(get_db)) -> UserOut:
    """Return the currently authenticated user's profile."""
    profile_result = await db.execute(
        select(UserProfile).where(UserProfile.user_id == current_user.id)
    )
    profile = profile_result.scalar_one_or_none()
    return _user_to_out(current_user, onboarding_completed=profile.onboarding_completed if profile else False)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _user_to_out(user: User, *, onboarding_completed: bool) -> UserOut:
    return UserOut(
        id=str(user.id),
        email=user.email,
        full_name=user.full_name,
        role=user.role.value,
        xp_total=user.xp_total,
        level=user.level,
        onboarding_completed=onboarding_completed,
    )


def _get_client_ip(request: Request) -> str:
    """
    Extract client IP strictly from socket connection to prevent header spoofing (NET-01).
    Header trust (e.g. X-Forwarded-For) is disabled until a trusted proxy configuration is bound.
    """
    return (request.client.host if request.client else "unknown")[:45]
