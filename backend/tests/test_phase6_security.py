"""
Phase 6 Security Verification Suite:
- IDOR & Tenant Isolation (with direct PostgreSQL verification)
- SEC-AUTH-02: Complete Token Revocation on Logout (Cookie and Bearer) + Replay Prevention
- JWT Algorithm & Signature Integrity (alg=none, expired token, tampered signature)
- CSRF Surface & Content-Type Behavior (text/plain bypass probing & CORS verification)
"""

import base64
import json
import os
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient, ASGITransport
from jose import jwt
import psycopg2
from sqlalchemy import select

from app.main import app
from app.config import get_settings
from app.database import AsyncSessionLocal
from app.models import User, UserSession, Lesson, Quiz, QuizQuestion, QuizAttempt, LessonProgress

settings = get_settings()
SYNC_URL = os.environ.get("DATABASE_URL_SYNC", "postgresql://postgres:sandeep%402004@localhost:5432/cm_test")


def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("utf-8")


@pytest.mark.asyncio
class TestIDORAndTenantIsolation:
    """Verifies that no tenant can read or mutate another tenant's progress or attempts."""

    async def test_idor_probe_on_registered_routes_and_nonexistent_paths(self):
        """
        Verify that:
        1. Speculative paths (/lessons/{id}/progress, /quiz/{id}/attempt/{id}) do NOT exist in app.routes (return 404 as unmapped routes).
        2. Real routes (/learn/progress, /auth/me) strictly scope to current_user.id.
        3. Injecting user_id in quiz submit payload does NOT create an attempt for User A in PostgreSQL.
        """
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # Register User A
            email_a = f"idor_a_{uuid.uuid4().hex[:6]}@example.com"
            reg_a = await client.post("/api/v1/auth/register", json={
                "full_name": "User Alpha", "email": email_a, "password": "Password123"
            })
            assert reg_a.status_code == 201
            user_a_id = reg_a.json()["user"]["id"]
            user_a_token = reg_a.cookies["access_token"]

            # User A completes a lesson and gets a quiz
            lessons_res = await client.get("/api/v1/learn/modules/network-defense-fundamentals/lessons", cookies={"access_token": user_a_token})
            assert lessons_res.status_code == 200
            lesson_id = lessons_res.json()[0]["id"]
            await client.post(f"/api/v1/learn/lessons/{lesson_id}/complete", cookies={"access_token": user_a_token})

            quiz_res = await client.get("/api/v1/learn/quizzes/network-defense-quiz", cookies={"access_token": user_a_token})
            quiz_id = quiz_res.json()["id"]
            questions = quiz_res.json()["questions"]
            answers = {q["id"]: q["options"][0]["id"] for q in questions}

            # Register User B
            email_b = f"idor_b_{uuid.uuid4().hex[:6]}@example.com"
            reg_b = await client.post("/api/v1/auth/register", json={
                "full_name": "User Bravo", "email": email_b, "password": "Password123"
            })
            assert reg_b.status_code == 201
            user_b_id = reg_b.json()["user"]["id"]
            user_b_token = reg_b.cookies["access_token"]

            # 1. Speculative routes return 404 because they are unmapped routes
            probe_paths = [
                f"/api/v1/lessons/{lesson_id}/progress",
                f"/api/v1/quiz/{quiz_id}/attempt/{uuid.uuid4()}",
                f"/api/v1/learn/lessons/{lesson_id}/progress",
                f"/api/v1/learn/quizzes/{quiz_id}/attempt/{uuid.uuid4()}",
            ]
            registered_paths = [r.path for r in app.routes]
            for path in probe_paths:
                # Confirm path is genuinely absent from registered routes
                assert path not in registered_paths
                res = await client.get(path, cookies={"access_token": user_b_token})
                assert res.status_code == 404

            # 2. User B queries progress -> returns strictly User B progress (0 XP, 0 completed lessons)
            prog_b = await client.get("/api/v1/learn/progress", cookies={"access_token": user_b_token})
            assert prog_b.status_code == 200
            data_b = prog_b.json()
            assert data_b["completed_lessons"] == []
            assert data_b["xp_total"] == 0

            # 3. User B queries /auth/me?user_id={user_a_id} -> returns User B's profile
            me_b = await client.get(f"/api/v1/auth/me?user_id={user_a_id}", cookies={"access_token": user_b_token})
            assert me_b.status_code == 200
            assert me_b.json()["id"] == user_b_id

            # 4. User B submits quiz with injected user_id in payload attempting to credit User A
            submit_res = await client.post(
                f"/api/v1/learn/quizzes/{quiz_id}/submit",
                json={"answers": answers, "user_id": user_a_id},
                cookies={"access_token": user_b_token}
            )
            assert submit_res.status_code == 200

            # Database Assertions: Verify in PostgreSQL directly
            with psycopg2.connect(SYNC_URL) as conn:
                with conn.cursor() as cur:
                    # User A must have ZERO attempts created by User B's call
                    cur.execute("SELECT COUNT(*) FROM quiz_attempts WHERE user_id = %s", (user_a_id,))
                    user_a_attempts = cur.fetchone()[0]
                    assert user_a_attempts == 0, f"IDOR vulnerability: User A has {user_a_attempts} attempts!"

                    # User B must have exactly 1 attempt
                    cur.execute("SELECT COUNT(*) FROM quiz_attempts WHERE user_id = %s", (user_b_id,))
                    user_b_attempts = cur.fetchone()[0]
                    assert user_b_attempts == 1


@pytest.mark.asyncio
class TestTokenRevocationAndReplayAfterLogout:
    """Tests SEC-AUTH-02: complete session revocation for cookie, bearer, and unauthenticated logouts."""

    async def test_cookie_logout_revokes_session_and_blocks_replay(self):
        """Logging out via Cookie sets revoked_at in DB and rejects replayed token with 401."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            email = f"cook_rev_{uuid.uuid4().hex[:6]}@example.com"
            reg = await client.post("/api/v1/auth/register", json={
                "full_name": "Cookie User", "email": email, "password": "Password123"
            })
            token = client.cookies["access_token"]
            jti = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])["jti"]

            # Token works before logout
            me_before = await client.get("/api/v1/auth/me")
            assert me_before.status_code == 200

            # Logout
            logout_res = await client.post("/api/v1/auth/logout")
            assert logout_res.status_code == 204

            # Verify PostgreSQL revoked_at is populated
            async with AsyncSessionLocal() as session:
                sess_row = (await session.execute(select(UserSession).where(UserSession.jti == jti))).scalar_one_or_none()
                assert sess_row is not None
                assert sess_row.revoked_at is not None

            # Replay attempt via Cookie -> 401
            replay_cookie = await client.get("/api/v1/auth/me", cookies={"access_token": token})
            assert replay_cookie.status_code == 401
            assert "Session revoked or not found" in replay_cookie.json()["detail"]

            # Replay attempt via Bearer header -> 401
            replay_bearer = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
            assert replay_bearer.status_code == 401
            assert "Session revoked or not found" in replay_bearer.json()["detail"]

    async def test_bearer_logout_revokes_session_and_blocks_replay(self):
        """Logging out via Authorization Bearer sets revoked_at in DB and rejects replayed token with 401."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as reg_client:
            email = f"bearer_rev_{uuid.uuid4().hex[:6]}@example.com"
            reg = await reg_client.post("/api/v1/auth/register", json={
                "full_name": "Bearer User", "email": email, "password": "Password123"
            })
            token = reg_client.cookies["access_token"]
            jti = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])["jti"]

        # Use clean client with zero cookies
        async with AsyncClient(transport=transport, base_url="http://test") as bearer_client:
            me_before = await bearer_client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
            assert me_before.status_code == 200

            # Call /logout with Authorization header only
            logout_res = await bearer_client.post("/api/v1/auth/logout", headers={"Authorization": f"Bearer {token}"})
            assert logout_res.status_code == 204

            # Verify PostgreSQL revoked_at is populated
            async with AsyncSessionLocal() as session:
                sess_row = (await session.execute(select(UserSession).where(UserSession.jti == jti))).scalar_one_or_none()
                assert sess_row is not None
                assert sess_row.revoked_at is not None

            # Replay with same bearer token -> 401
            me_after = await bearer_client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
            assert me_after.status_code == 401
            assert "Session revoked or not found" in me_after.json()["detail"]

    async def test_unauthenticated_logout_returns_401(self):
        """Calling /logout with neither cookie nor Bearer token returns 401 Unauthorized."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.post("/api/v1/auth/logout")
            assert res.status_code == 401
            assert res.json()["detail"] == "Not authenticated"

    async def test_invalid_token_logout_returns_401(self):
        """Calling /logout with a malformed Bearer token returns 401 Unauthorized."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.post("/api/v1/auth/logout", headers={"Authorization": "Bearer not.a.valid.jwt"})
            assert res.status_code == 401
            assert res.json()["detail"] == "Invalid or expired token"


@pytest.mark.asyncio
class TestJWTSignatureAndAlgorithmIntegrity:
    """Verifies that alg=none, expired tokens, and corrupted signatures are rejected."""

    async def test_alg_none_token_rejected(self):
        """Tokens with alg='none' are strictly rejected with 401 Unauthorized."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            hdr = b64url(json.dumps({"alg": "none", "typ": "JWT"}).encode("utf-8"))
            pay = b64url(json.dumps({"sub": str(uuid.uuid4()), "jti": uuid.uuid4().hex, "type": "access"}).encode("utf-8"))
            token_dot = f"{hdr}.{pay}."
            token_nodot = f"{hdr}.{pay}"

            res1 = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token_dot}"})
            assert res1.status_code == 401
            assert res1.json()["detail"] == "Invalid or expired token"

            res2 = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token_nodot}"})
            assert res2.status_code == 401
            assert res2.json()["detail"] == "Invalid or expired token"

    async def test_expired_token_returns_401_not_500(self):
        """Expired tokens return clean HTTP 401 without unhandled 500 exceptions."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            payload = {
                "sub": str(uuid.uuid4()),
                "jti": uuid.uuid4().hex,
                "iat": int((datetime.now(timezone.utc) - timedelta(hours=2)).timestamp()),
                "exp": int((datetime.now(timezone.utc) - timedelta(hours=1)).timestamp()),
                "type": "access",
            }
            expired_token = jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)

            res = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {expired_token}"})
            assert res.status_code == 401
            assert res.json()["detail"] == "Invalid or expired token"

    async def test_tampered_signature_and_foreign_key_rejected(self):
        """Corrupted signature bytes or foreign HMAC key signatures return 401."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            reg = await client.post("/api/v1/auth/register", json={
                "full_name": "Sig User", "email": f"sig_{uuid.uuid4().hex[:6]}@example.com", "password": "Password123"
            })
            token = client.cookies["access_token"]
            client.cookies.clear()

            parts = token.split(".")
            corrupted_sig = ("A" if parts[2][0] != "A" else "B") + parts[2][1:]
            tampered = f"{parts[0]}.{parts[1]}.{corrupted_sig}"

            res_tampered = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {tampered}"})
            assert res_tampered.status_code == 401
            assert res_tampered.json()["detail"] == "Invalid or expired token"

            # Foreign key
            foreign_token = jwt.encode({"sub": str(uuid.uuid4()), "jti": uuid.uuid4().hex, "type": "access"}, "wrong_key_12345", algorithm="HS256")
            res_foreign = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {foreign_token}"})
            assert res_foreign.status_code == 401


@pytest.mark.asyncio
class TestCSRFAndContentTypeBehavior:
    """Tests CSRF behavior with text/plain payloads and verifies CORS whitelist configuration."""

    async def test_origin_checking_middleware_blocks_cross_origin_mutations(self):
        """
        Verify Origin-checking CSRF middleware:
        1. POST with untrusted Origin (http://evil.com) is rejected with HTTP 403 Forbidden.
        2. POST with allowed Origin (http://localhost:3000) succeeds with HTTP 200 OK.
        3. POST without Origin header (non-browser API client) succeeds with HTTP 200 OK.
        """
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            email = f"origin_{uuid.uuid4().hex[:6]}@example.com"
            reg = await client.post("/api/v1/auth/register", json={
                "full_name": "Origin User", "email": email, "password": "Password123"
            })
            token = client.cookies["access_token"]

            lessons = (await client.get("/api/v1/learn/modules/network-defense-fundamentals/lessons")).json()
            lesson_id = lessons[0]["id"]

            # 1. Untrusted Origin -> 403 Forbidden
            res_evil = await client.post(
                f"/api/v1/learn/lessons/{lesson_id}/complete",
                headers={"Origin": "http://evil.com"},
                cookies={"access_token": token}
            )
            assert res_evil.status_code == 403
            assert "Cross-origin request rejected" in res_evil.json()["detail"]

            # 2. Allowed Origin -> 200 OK
            res_allowed = await client.post(
                f"/api/v1/learn/lessons/{lesson_id}/complete",
                headers={"Origin": "http://localhost:3000"},
                cookies={"access_token": token}
            )
            assert res_allowed.status_code == 200

            # 3. No Origin (API/mobile client) -> 200 OK
            res_no_origin = await client.post(
                f"/api/v1/learn/lessons/{lesson_id}/complete",
                cookies={"access_token": token}
            )
            assert res_no_origin.status_code == 200

    async def test_text_plain_content_type_behavior(self):
        """
        Probe mutating endpoints with Content-Type: text/plain:
        Endpoints declaring Pydantic request bodies (/quizzes/{id}/submit) reject text/plain JSON strings with 422 Unprocessable Entity.
        """
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            email = f"csrf_{uuid.uuid4().hex[:6]}@example.com"
            reg = await client.post("/api/v1/auth/register", json={
                "full_name": "CSRF User", "email": email, "password": "Password123"
            })
            token = client.cookies["access_token"]

            quizzes = (await client.get("/api/v1/learn/quizzes/network-defense-quiz")).json()
            quiz_id = quizzes["id"]
            res_submit = await client.post(
                f"/api/v1/learn/quizzes/{quiz_id}/submit",
                headers={"Content-Type": "text/plain", "Origin": "http://localhost:3000"},
                content=json.dumps({"answers": {"q1": "b"}}),
                cookies={"access_token": token}
            )
            # FastAPI rejects raw text/plain string where Pydantic model is required
            assert res_submit.status_code == 422

    async def test_cors_whitelist_rejects_untrusted_origins(self):
        """CORS middleware rejects untrusted origins on preflight OPTIONS requests."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.options(
                "/api/v1/learn/progress",
                headers={
                    "Origin": "http://malicious-attacker-site.com",
                    "Access-Control-Request-Method": "GET",
                }
            )
            assert res.status_code == 400
            assert "access-control-allow-origin" not in res.headers
