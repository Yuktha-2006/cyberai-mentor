"""
Tests for authentication security functions.
"""

import pytest
from app.security import hash_password, verify_password, needs_rehash, create_access_token, generate_jti, decode_token


class TestPasswordHashing:
    def test_hash_produces_argon2id_hash(self):
        h = hash_password("SecurePass1")
        assert h.startswith("$argon2id$")

    def test_verify_correct_password(self):
        h = hash_password("SecurePass1")
        assert verify_password("SecurePass1", h) is True

    def test_verify_wrong_password(self):
        h = hash_password("SecurePass1")
        assert verify_password("WrongPass!", h) is False

    def test_same_password_different_hashes(self):
        """Salting: same password produces different hashes."""
        h1 = hash_password("SecurePass1")
        h2 = hash_password("SecurePass1")
        assert h1 != h2

    def test_verify_returns_false_on_invalid_hash(self):
        assert verify_password("anything", "not_a_valid_hash") is False

    def test_empty_password_fails_verification(self):
        h = hash_password("SecurePass1")
        assert verify_password("", h) is False

    def test_needs_rehash_fresh_hash(self):
        """A freshly generated hash should NOT need rehashing."""
        h = hash_password("SecurePass1")
        assert needs_rehash(h) is False


class TestJWTTokens:
    def test_access_token_roundtrip(self):
        jti = generate_jti()
        user_id = "test-user-123"
        token, expires_at = create_access_token(user_id, jti)
        payload = decode_token(token)
        assert payload["sub"] == user_id
        assert payload["jti"] == jti
        assert payload["type"] == "access"

    def test_jti_is_unique(self):
        jtis = {generate_jti() for _ in range(100)}
        assert len(jtis) == 100

    def test_jti_length(self):
        jti = generate_jti()
        assert len(jti) == 64  # 32 bytes hex = 64 chars

    def test_invalid_token_raises(self):
        from jose import JWTError
        with pytest.raises(JWTError):
            decode_token("this.is.invalid")

    def test_tampered_token_raises(self):
        from jose import JWTError
        jti = generate_jti()
        token, _ = create_access_token("user-1", jti)
        # Tamper with payload section
        parts = token.split(".")
        parts[1] = parts[1] + "tampered"
        tampered = ".".join(parts)
        with pytest.raises(JWTError):
            decode_token(tampered)
