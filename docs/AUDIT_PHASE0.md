# Phase 0 Audit Report — CyberMentor AI

Date: 2026-10-29
Scope: Read-only review of the existing repository and evidence artifacts. No application source code was modified during this audit.

## Executive Summary

This project shows a strong security-oriented engineering baseline for a cybersecurity learning platform. The backend and frontend are intentionally structured around authentication, deterministic scoring, anti-replay XP logic, and safe AI guidance boundaries. The codebase is not a generic starter app; it is a focused product with specific controls around grading, session security, and mentor safety.

The most important risk identified in this read-only audit is not a hidden backdoor or injected malicious logic. Instead, the primary issue is dependency hygiene: the frontend currently depends on a Next.js version that npm audit flags as vulnerable, and the recommended remediation is a breaking-version upgrade path rather than a patch-only change.

## What was reviewed

- Repository state and branch status
- Backend configuration and app bootstrap
- Authentication and security primitives
- Database/test-environment guardrails
- Frontend build and dependency audit evidence
- Historical evidence files in `evidence/`

## Evidence reviewed

### 1) Security architecture appears intentionally designed

Relevant files reviewed:
- `backend/app/security.py`
- `backend/app/main.py`
- `backend/app/config.py`
- `backend/app/routers/auth.py`

Confirmed implementation details:
- Password hashing uses Argon2id with the OWASP-aligned parameters `m=65536`, `t=3`, and `p=4`.
- JWTs include a server-side JTI (`jti`) value for token revocation and logout handling.
- HTTP middleware adds CSRF-style origin validation for browser requests and sets protective headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, etc.).
- Auth logic supports both HttpOnly cookies and bearer-token flows while preserving server-side revocation semantics.

Assessment:
- This is a deliberate security-focused design rather than an accidental or minimal implementation.
- The security controls are aligned with the problem domain and product constraints.

### 2) Backend test suite is substantial and passes under the project’s intended environment

Relevant files reviewed:
- `backend/tests/conftest.py`
- `backend/tests/*`
- `evidence/clean_venv_pytest.txt`
- `evidence/postgres_pytest_baseline.txt`

Verified facts:
- The project’s test setup explicitly asserts that tests are running against PostgreSQL.
- The test suite collects 46 tests and passes in the project’s intended environment.
- Evidence shows: `46 passed` in 4.10s and again `46 passed` in 13.67s across project evidence records.

Important nuance:
- This project is not designed to pass under a generic SQLite-only quick-start environment.
- `backend/tests/conftest.py` intentionally fails early if the dialect is not PostgreSQL unless `ALLOW_SQLITE_TESTS=1` is set.
- That is a validation guard, not necessarily a defect in the application itself.

Assessment:
- Confidence in backend correctness is higher when running under real PostgreSQL, which matches the intended environment.
- The project should clearly document this dependency to avoid false negatives during local setup.

### 3) The frontend compiles successfully, but dependency risk remains

Relevant files reviewed:
- `frontend/package.json`
- `evidence/npm_build_strict.txt`
- `evidence/npm_audit_production.txt`

Verified facts:
- The production frontend build completes successfully.
- `next build` reports successful compilation and static generation across the app routes.
- `npm audit` reports multiple significant vulnerabilities affecting `next` and its transitive `postcss` and `zod` path.
- The audit output specifically states that a breaking-change upgrade is required via `npm audit fix --force`, which would move the project to a newer `next` major version.

Key finding:
- Severity summary from the evidence: `3 vulnerabilities (2 high, 1 critical)`.
- The high-level risk is not merely code quality; it is a real production security risk for a self-hosted Next.js deployment.

Assessment:
- The app builds correctly, but it is not currently dependency-clean from a security perspective.
- This is the highest-priority issue for Phase 1 remediation if the project is being hardened for release.

### 4) The code appears to be deliberately designed around learning-security boundaries

Relevant files reviewed:
- `backend/app/routers/mentor.py`
- `backend/app/models.py`
- `backend/app/routers/learning.py`

Validated patterns:
- AI mentor routes are constrained by a safety system prompt and are not intended to directly alter scores or XP.
- XP transactions are guarded by database-level and logic-level anti-duplication controls.
- The product explicitly treats answer keys and grading logic as backend-owned, not client-exposed.

Assessment:
- This product has a thoughtful “safe educational AI” boundary model rather than unrestricted prompt-driven write access.
- That direction is consistent with security best practices for a training platform.

## Findings summary

### Status: No critical application backdoor or malicious code found in the audited scope

The read-only review did not reveal evidence of intentionally malicious code injection, hidden privileged data exfiltration, or unauthorized mutation logic in the inspected source files.

### Priority findings

1. High: Frontend dependency vulnerabilities in the existing Next.js stack
   - Evidence: `evidence/npm_audit_production.txt`
   - Status: Needs product-level dependency upgrade planning

2. Medium: PostgreSQL dependency is enforced but not always described clearly
   - Evidence: `backend/tests/conftest.py`
   - Status: Local setup guidance should be explicit to avoid confusion

3. Medium: Python deprecation warnings related to JWT time handling
   - Evidence: warnings in pytest output
   - Status: Not a functional blocker, but should be cleaned up

4. Low: Environment and secrets hygiene should be monitored in deployment
   - Evidence: presence of `.env`-related configuration and project-level env usage
   - Status: Ensure production values are kept out of source control and rotated appropriately

## Read-only conclusion

This repository appears to be a viable, security-conscious cyber learning application with a meaningful backend security model and a working frontend build. The overall engineering intent is mature and product-focused.

The main risk requiring action before a production-grade release is the known vulnerable dependency chain in the frontend stack, especially the `next` version. This should be treated as an upgrade and release-planning item, not as a hidden defect in the application logic.

## Recommendation for next phase

The next phase should be narrowly scoped to:
- dependency update planning and validation,
- environment/documentation cleanup,
- deprecation cleanup, and
- final release preparation review.

No source-code remediation was performed during this audit, as requested.
