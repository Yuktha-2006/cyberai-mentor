# CyberMentor AI — AI-Powered Cybersecurity Learning Platform

[![Next.js](https://img.shields.io/badge/Next.js-14.2.5-black?style=flat&logo=next.js)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111.0-009688?style=flat&logo=fastapi)](https://fastapi.tiangolo.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-3.11%2B-3776AB?style=flat&logo=python)](https://www.python.org/)
[![Security](https://img.shields.io/badge/Security-Argon2id-critical)](https://github.com/P-H-C/phc-winner-argon2)
[![Tests](https://img.shields.io/badge/Tests-26%20Passed-success)](https://pytest.org/)

CyberMentor AI is a production-minded cybersecurity learning platform and cyber range designed for aspiring SOC analysts, application security engineers, cloud security practitioners, and GRC specialists.

---

## 🛡️ Core Product Architecture

```
                  ┌─────────────────────────────────────────┐
                  │             Next.js 14 App              │
                  │   (TypeScript, Tailwind CSS, shadcn)    │
                  └────────────────────┬────────────────────┘
                                       │ HTTPS / HttpOnly Cookies
                                       ▼
                  ┌─────────────────────────────────────────┐
                  │             FastAPI Backend             │
                  │    - Argon2id Password Hashing          │
                  │    - Deterministic Grading Engine       │
                  │    - Anti-Replay XP Transactions        │
                  │    - Boundary-Guarded AI Mentor         │
                  └────────────────────┬────────────────────┘
                                       │ Async SQLAlchemy 2.0
                                       ▼
                  ┌─────────────────────────────────────────┐
                  │          PostgreSQL Database            │
                  │    (Transactions, Constraints, Alembic) │
                  └─────────────────────────────────────────┘
```

---

## 🔐 Security & Engineering Quality Principles

1. **Deterministic Evaluation Guarantee**:
   - Assessment scoring and grading are calculated strictly on the backend.
   - Question answer keys and explanations are **never** exposed in client-facing quiz payloads.
   - The AI mentor provides educational guidance and explanation — it is architecturally isolated from issuing grades or altering XP records.

2. **Idempotent Anti-Replay XP System**:
   - XP is awarded through structured `XPTransaction` records guarded by `UniqueConstraint` and atomic check flags.
   - Repeated submissions cannot inflate learner levels or duplicate rewards.

3. **Argon2id Password Security**:
   - State-of-the-art password hashing using Argon2id (Winner of the Password Hashing Competition) configured to OWASP recommendations:
     - Memory: 64 MB (`m=65536`)
     - Iterations: 3 (`t=3`)
     - Parallelism: 4 (`p=4`)

4. **Defense in Depth**:
   - HttpOnly, SameSite strict session cookies.
   - Hardened HTTP security headers (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`).

---

## 🚀 The Complete Learner Journey

1. **Authentication**: Register with strong password enforcement → Log in with Argon2id verification and receive secure session cookie.
2. **Diagnostic Onboarding**: Select target career path (`SOC Analyst`, `AppSec`, `Cloud Security`) → Complete 10-question baseline diagnostic scored deterministically across 5 security domains.
3. **Learner Dashboard**: Real-time XP tracking, dynamic level calculations, skill radar breakdown, and curated curriculum recommendations.
4. **Interactive Curriculum**: Deep-dive into technical cybersecurity modules (e.g., *Network Defense & Traffic Analysis*, *OWASP Top 10 Web Defense*).
5. **Practical Labs**: Investigate simulated brute-force intrusions in the SIEM log viewer and apply firewall containment rules (`DROP`).
6. **Deterministic Certification Quizzes**: Complete time-limited evaluations with immediate score calculation, boundary grading, and XP awards.
7. **AI Mentor Guidance**: Ask clarifying questions to an explainable tutor adhering to safe defensive cybersecurity guardrails.

---

## 🛠️ Verification & Test Suite

### Backend Test Results (`pytest`)
All 46 automated unit, integration, and adversarial tests pass when run against PostgreSQL.

Run tests:
```powershell
cd backend
pytest tests/ -v
```

### Frontend Build & Type Check
- **`tsc --noEmit`**: 0 errors (strict TypeScript mode).
- **`next build`**: 11 production routes compiled, static pages prerendered, and bundles optimized.

Run build:
```powershell
cd frontend
npm run type-check
npm run build
```

---

## 📦 Getting Started

### Backend Setup
```powershell
cd backend
python -m pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

### Frontend Setup
```powershell
cd frontend
npm install --legacy-peer-deps
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the application.
