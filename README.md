# CyberMentor AI

[![CI](https://github.com/Yuktha-2006/cyberai-mentor/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Yuktha-2006/cyberai-mentor/actions/workflows/ci.yml)

CyberMentor AI is a cybersecurity learning platform with deterministic assessments, simulated SOC labs, learner progress tracking, and an AI mentor constrained to educational guidance.

## Technology

- **Frontend:** Next.js 16, React 18, TypeScript, Tailwind CSS
- **Backend:** FastAPI, Python 3.11+, SQLAlchemy 2, Alembic
- **Database:** PostgreSQL 16
- **Testing:** pytest, Vitest, React Testing Library, Playwright

## Start the Application

Install Docker Desktop or Docker Engine with the Compose plugin, then from the repository root run:

```bash
docker compose up --build
```

The stack starts PostgreSQL, applies backend migrations, seeds the curriculum, then starts the API and frontend.

- Frontend: [http://localhost:3000](http://localhost:3000)
- API health: [http://localhost:8000/health](http://localhost:8000/health)
- Development API docs: [http://localhost:8000/docs](http://localhost:8000/docs)

Create an account through the app and complete onboarding to use the learner dashboard. Optional server-side provider keys are `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, and `GROQ_API_KEY`. Without a provider key, the mentor uses its embedded response engine.

Compose defaults are for local development only. Set private values for `POSTGRES_PASSWORD` and `SECRET_KEY` before sharing the environment; never use the local defaults in deployment. Stop the services with Ctrl+C. Run `docker compose down` to remove containers while retaining the database volume, or `docker compose down -v` to remove the volume as well.

## Security Architecture

- **Authentication:** Argon2id password hashing, signed JWT sessions, HttpOnly cookies, and server-side JTI revocation.
- **Assessment integrity:** Quiz scores are computed by the backend. Answer keys are omitted from quiz-fetch responses and revealed only through post-submission feedback.
- **XP integrity:** XP awards are transaction-backed and idempotent, with unique database constraints and concurrency coverage.
- **AI boundary:** The mentor has no direct write path to XP or grades. Adversarial tests submit prompt-injection and unauthorized-award requests, then assert existing grades, XP, and ledger state remain unchanged.
- **Transport and browser controls:** Origin validation for browser mutation requests, CORS allowlisting, and security response headers.
- **Dependencies:** The latest production-only `npm audit --omit=dev` reported **0 vulnerabilities**. Development dependencies are excluded, and this result is not a guarantee about future releases.

See [THREAT_MODEL.md](THREAT_MODEL.md) for the STRIDE review and [DEMO_SCRIPT.md](DEMO_SCRIPT.md) for a university-panel walkthrough.

## Tests and Checks

Verified project counts:

- **72 backend pytest tests** with PostgreSQL, including concurrency, authentication, and adversarial AI security coverage.
- **1 Vitest component test** using React Testing Library.
- **1 Playwright E2E test** covering mocked login through dashboard rendering.

Run the backend checks with a PostgreSQL test database configured through `DATABASE_URL`, `DATABASE_URL_SYNC`, and `TEST_DATABASE_URL`, plus `SECRET_KEY`:

```bash
cd backend
python -m pip install -r requirements.txt
python -m alembic upgrade head
python -m pytest
```

Run frontend checks from `frontend/`:

```bash
npm ci
npm run test
npm run lint
npm run build
npx playwright install chromium
npm run test:e2e
```

GitHub Actions runs the PostgreSQL-backed backend suite and the frontend install, component tests, lint, production build, and Playwright E2E test.

## Screenshots

![Dashboard](link-to-image)

![AI Mentor](link-to-image)

![SIEM Lab](link-to-image)