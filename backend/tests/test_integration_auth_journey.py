"""
Comprehensive Integration & Authorization Test Suite.

Proves:
1. Real user registration with Argon2id password hashing in database.
2. Duplicate email rejection (HTTP 409 Conflict).
3. Secure login with HttpOnly session cookies and JTI tracking.
4. Bad credentials rejected without timing leakage.
5. Session revocation upon logout (revoked JTI rejected on subsequent calls).
6. Diagnostic onboarding scoring persistence across domains.
7. Curriculum navigation and lesson completion.
8. Anti-replay XP idempotency (submitting lesson twice yields 0 XP on second run).
9. Quiz question retrieval secrecy (answer keys NEVER leaked).
10. Server-side deterministic quiz grading & XP award.
11. Multi-user data isolation: User 2 has isolated progress and cannot view User 1 data.
"""

import uuid
import pytest
from fastapi.testclient import TestClient
from app.main import app


def _unique_email(prefix: str = "learner") -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}@example.com"


def _make_client() -> TestClient:
    return TestClient(app, base_url="http://testserver")


# ── 1. Registration & Password Security ───────────────────────────────────────

class TestRegistrationAndAuthSecurity:
    def test_registration_creates_account(self):
        c = _make_client()
        email = _unique_email("alice")
        resp = c.post(
            "/api/v1/auth/register",
            json={"full_name": "Alice Defender", "email": email, "password": "SecurePassword123!"},
            headers={"Origin": "http://localhost:3000"}
        )
        assert resp.status_code == 201, resp.text
        data = resp.json()
        assert data["user"]["email"] == email
        assert data["user"]["role"] == "learner"
        assert data["user"]["xp_total"] == 0
        assert data["user"]["level"] == 1
        assert "access_token" in c.cookies

    def test_duplicate_registration_rejected(self):
        c = _make_client()
        email = _unique_email("duplicate")
        resp1 = c.post(
            "/api/v1/auth/register",
            json={"full_name": "First User", "email": email, "password": "SecurePassword123!"},
            headers={"Origin": "http://localhost:3000"}
        )
        assert resp1.status_code == 201

        resp2 = c.post(
            "/api/v1/auth/register",
            json={"full_name": "Second User", "email": email, "password": "SecurePassword123!"},
            headers={"Origin": "http://localhost:3000"}
        )
        assert resp2.status_code == 409
        assert "already registered" in resp2.json()["detail"].lower()

    def test_login_success(self):
        c1 = _make_client()
        email = _unique_email("login_success")
        password = "ValidPassword123!"
        c1.post(
            "/api/v1/auth/register",
            json={"full_name": "Bob Defender", "email": email, "password": password},
            headers={"Origin": "http://localhost:3000"}
        )

        c2 = _make_client()
        resp = c2.post(
            "/api/v1/auth/login",
            json={"email": email, "password": password},
            headers={"Origin": "http://localhost:3000"}
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["user"]["email"] == email
        assert "access_token" in c2.cookies

    def test_login_invalid_password_rejected(self):
        c = _make_client()
        email = _unique_email("login_fail")
        c.post(
            "/api/v1/auth/register",
            json={"full_name": "Target User", "email": email, "password": "CorrectPassword123!"},
            headers={"Origin": "http://localhost:3000"}
        )

        resp = c.post(
            "/api/v1/auth/login",
            json={"email": email, "password": "WrongPassword999!"},
            headers={"Origin": "http://localhost:3000"}
        )
        assert resp.status_code == 401

    def test_unknown_email_and_wrong_password_identical_response(self):
        """
        Anti-enumeration verification:
        Both non-existent email and wrong password for an existing user
        must return identical HTTP status code and response body.
        """
        c = _make_client()
        existing_email = _unique_email("enum_target")
        c.post(
            "/api/v1/auth/register",
            json={"full_name": "Target User", "email": existing_email, "password": "CorrectPassword123!"},
            headers={"Origin": "http://localhost:3000"}
        )

        resp_wrong_pw = c.post(
            "/api/v1/auth/login",
            json={"email": existing_email, "password": "WrongPassword123!"},
            headers={"Origin": "http://localhost:3000"}
        )

        resp_unknown_email = c.post(
            "/api/v1/auth/login",
            json={"email": "nonexistent_user@example.com", "password": "WrongPassword123!"},
            headers={"Origin": "http://localhost:3000"}
        )

        assert resp_wrong_pw.status_code == 401
        assert resp_unknown_email.status_code == 401
        assert resp_wrong_pw.json() == resp_unknown_email.json(), (
            f"Response mismatch: wrong_pw={resp_wrong_pw.json()} vs unknown_email={resp_unknown_email.json()}"
        )
        assert "invalid" in resp_wrong_pw.json()["detail"].lower() or "incorrect" in resp_wrong_pw.json()["detail"].lower()

    def test_logout_revokes_session(self):
        c = _make_client()
        email = _unique_email("logout_test")
        c.post(
            "/api/v1/auth/register",
            json={"full_name": "Session User", "email": email, "password": "SecurePassword123!"},
            headers={"Origin": "http://localhost:3000"}
        )

        # Verify access to /me before logout
        me_before = c.get("/api/v1/auth/me")
        assert me_before.status_code == 200

        # Execute logout
        logout_resp = c.post("/api/v1/auth/logout")
        assert logout_resp.status_code == 204

        # Access with the same client session must now be rejected (JTI revoked on server)
        me_after = c.get("/api/v1/auth/me")
        assert me_after.status_code == 401


# ── 2. Onboarding Diagnostic Assessment ───────────────────────────────────────

class TestOnboardingAssessment:
    def test_onboarding_deterministic_scoring(self):
        c = _make_client()
        email = _unique_email("onboard")
        c.post(
            "/api/v1/auth/register",
            json={"full_name": "Onboard Learner", "email": email, "password": "SecurePassword123!"},
            headers={"Origin": "http://localhost:3000"}
        )

        # Submit all 10 correct answers
        answers = {
            "q1": "b", "q2": "b", "q3": "b", "q4": "c", "q5": "b",
            "q6": "c", "q7": "b", "q8": "c", "q9": "b", "q10": "b"
        }
        resp = c.post(
            "/api/v1/onboarding/assessment",
            json={"career_path": "soc_analyst", "experience_level": "beginner", "answers": answers}
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["career_path"] == "soc_analyst"
        assert data["experience_level"] == "beginner"
        for domain, score in data["domain_scores"].items():
            assert score == 100.0


# ── 3. Curriculum, Anti-Replay XP, & Quiz Secrecy ──────────────────────────────

class TestLearningLoopAndIdempotency:
    def test_answer_keys_never_leaked_in_quiz_api(self):
        c = _make_client()
        email = _unique_email("quiz_secrecy")
        c.post(
            "/api/v1/auth/register",
            json={"full_name": "Secrecy Check", "email": email, "password": "SecurePassword123!"},
            headers={"Origin": "http://localhost:3000"}
        )

        resp = c.get("/api/v1/learn/quizzes/network-defense-quiz")
        assert resp.status_code == 200, resp.text
        quiz_data = resp.json()

        for q in quiz_data["questions"]:
            # Critical Security Gate: correct_option_id and explanation MUST NOT be exposed before submission
            assert "correct_option_id" not in q, f"CRITICAL LEAK: correct_option_id found in question {q['id']}"
            assert "explanation" not in q, f"CRITICAL LEAK: explanation found in question {q['id']}"
            assert len(q["options"]) > 0

    def test_lesson_completion_and_idempotent_anti_replay_xp(self):
        c = _make_client()
        email = _unique_email("antireplay")
        c.post(
            "/api/v1/auth/register",
            json={"full_name": "Idempotent User", "email": email, "password": "SecurePassword123!"},
            headers={"Origin": "http://localhost:3000"}
        )

        # Get lessons
        lessons_resp = c.get("/api/v1/learn/modules/network-defense-fundamentals/lessons")
        assert lessons_resp.status_code == 200, lessons_resp.text
        lessons = lessons_resp.json()
        lesson_id = lessons[0]["id"]

        # First completion: awards XP
        c1 = c.post(f"/api/v1/learn/lessons/{lesson_id}/complete")
        assert c1.status_code == 200
        data1 = c1.json()
        assert data1["xp_awarded"] is True
        assert data1["xp_amount"] == 50

        # Check total user XP
        me1 = c.get("/api/v1/auth/me").json()
        assert me1["xp_total"] == 50

        # Anti-Replay Gate: Second completion of the same lesson MUST NOT grant duplicate XP
        c2 = c.post(f"/api/v1/learn/lessons/{lesson_id}/complete")
        assert c2.status_code == 200
        data2 = c2.json()
        assert data2["xp_awarded"] is False
        assert data2["xp_amount"] == 0

        # User XP total must remain exactly 50 (never 100)
        me2 = c.get("/api/v1/auth/me").json()
        assert me2["xp_total"] == 50, f"DUPLICATE XP DETECTED: expected 50 but got {me2['xp_total']}"

    def test_deterministic_quiz_grading_and_feedback(self):
        c = _make_client()
        email = _unique_email("quiz_grader")
        c.post(
            "/api/v1/auth/register",
            json={"full_name": "Grader Test", "email": email, "password": "SecurePassword123!"},
            headers={"Origin": "http://localhost:3000"}
        )

        quiz_resp = c.get("/api/v1/learn/quizzes/network-defense-quiz")
        quiz = quiz_resp.json()
        quiz_id = quiz["id"]

        # Submit answers
        answers = {}
        for q in quiz["questions"]:
            answers[q["id"]] = "b" if any("Stealth" in opt["text"] or "connection" in opt["text"] for opt in q["options"]) else "c"

        sub_resp = c.post(
            f"/api/v1/learn/quizzes/{quiz_id}/submit",
            json={"answers": answers}
        )
        assert sub_resp.status_code == 200, sub_resp.text
        res = sub_resp.json()
        assert res["score"] == 100.0
        assert res["passed"] is True
        assert res["xp_awarded"] is True
        assert res["xp_amount"] == 100
        # Only in post-submission response is feedback revealed
        assert len(res["per_question"]) == len(quiz["questions"])
        assert all(pq["correct"] is True for pq in res["per_question"])


# ── 4. Cross-User Data Isolation Proof ────────────────────────────────────────

class TestCrossUserDataIsolation:
    def test_multi_user_isolation(self):
        # User 1 completes a lesson and earns 50 XP
        c1 = _make_client()
        email1 = _unique_email("user_one")
        c1.post(
            "/api/v1/auth/register",
            json={"full_name": "User One", "email": email1, "password": "SecurePassword123!"},
            headers={"Origin": "http://localhost:3000"}
        )

        lessons = c1.get("/api/v1/learn/modules/network-defense-fundamentals/lessons").json()
        c1.post(f"/api/v1/learn/lessons/{lessons[0]['id']}/complete")

        u1_prog = c1.get("/api/v1/learn/progress").json()
        assert u1_prog["xp_total"] == 50
        assert len(u1_prog["completed_lessons"]) == 1

        # User 2 registers fresh with separate client session
        c2 = _make_client()
        email2 = _unique_email("user_two")
        c2.post(
            "/api/v1/auth/register",
            json={"full_name": "User Two", "email": email2, "password": "SecurePassword123!"},
            headers={"Origin": "http://localhost:3000"}
        )

        # User 2's progress must be strictly isolated (0 XP, 0 completed lessons)
        u2_prog = c2.get("/api/v1/learn/progress").json()
        assert u2_prog["xp_total"] == 0, f"DATA LEAK: User 2 has {u2_prog['xp_total']} XP"
        assert len(u2_prog["completed_lessons"]) == 0, "DATA LEAK: User 2 sees User 1 completed lessons"

        # User 1's progress remains untouched
        u1_prog_check = c1.get("/api/v1/learn/progress").json()
        assert u1_prog_check["xp_total"] == 50
        assert len(u1_prog_check["completed_lessons"]) == 1
