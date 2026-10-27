"""
Security services: password hashing (Argon2id) and JWT management.
Argon2id is the Password Hashing Competition winner — resistant to GPU/ASIC attacks.
"""

import secrets
from datetime import datetime, timedelta, timezone

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError, InvalidHashError
from jose import JWTError, jwt

# Settings are loaded lazily to allow importing this module in tests without env vars
def _settings():
    from app.config import get_settings
    return get_settings()

# Argon2id with secure defaults (OWASP recommended: m=64MB, t=3, p=4)
_hasher = PasswordHasher(
    time_cost=3,
    memory_cost=65536,  # 64 MB
    parallelism=4,
    hash_len=32,
    salt_len=16,
    encoding="utf-8",
)


def hash_password(plain_password: str) -> str:
    """Hash a plain-text password using Argon2id."""
    return _hasher.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a password against its hash.
    Returns False on any mismatch — never raises to caller.
    """
    try:
        return _hasher.verify(hashed_password, plain_password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def needs_rehash(hashed_password: str) -> bool:
    """Check if the hash parameters are outdated and need upgrading."""
    return _hasher.check_needs_rehash(hashed_password)


def create_access_token(user_id: str, jti: str) -> tuple[str, datetime]:
    """
    Create a signed JWT access token.
    Returns (token, expires_at).
    The jti (JWT ID) is stored server-side to enable logout/revocation.
    """
    s = _settings()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=s.access_token_expire_minutes)
    payload = {
        "sub": str(user_id),
        "jti": jti,
        "iat": datetime.now(timezone.utc),
        "exp": expires_at,
        "type": "access",
    }
    token = jwt.encode(payload, s.secret_key, algorithm=s.algorithm)
    return token, expires_at


def create_refresh_token(user_id: str, jti: str) -> tuple[str, datetime]:
    """Create a signed JWT refresh token."""
    s = _settings()
    expires_at = datetime.now(timezone.utc) + timedelta(days=s.refresh_token_expire_days)
    payload = {
        "sub": str(user_id),
        "jti": jti,
        "iat": datetime.now(timezone.utc),
        "exp": expires_at,
        "type": "refresh",
    }
    token = jwt.encode(payload, s.secret_key, algorithm=s.algorithm)
    return token, expires_at


def decode_token(token: str) -> dict:
    """
    Decode and validate a JWT.
    Raises JWTError on any failure — caller must handle.
    """
    s = _settings()
    return jwt.decode(token, s.secret_key, algorithms=[s.algorithm])


def generate_jti() -> str:
    """Generate a cryptographically random JWT ID."""
    return secrets.token_hex(32)
