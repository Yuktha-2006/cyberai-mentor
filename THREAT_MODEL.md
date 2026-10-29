# CyberMentor AI Threat Model

## Scope and Security Objectives

This STRIDE review covers the browser client, FastAPI service, PostgreSQL database, and optional external AI providers. The primary security objectives are to protect learner accounts and progress, keep assessment answers confidential until submission, award XP only through verified platform actions, and constrain AI output to an educational role.

## Assets and Trust Boundaries

- Account credentials, session tokens, profile data, and learner progress
- Quiz answer keys, submitted answers, grades, XP totals, and the XP transaction ledger
- AI provider credentials and mentor conversation content
- Browser-to-API requests, API-to-database queries, and API-to-provider requests

The browser is untrusted. Authorization and grading decisions are enforced by the backend. The database is the source of truth for grades, sessions, and XP. External AI providers receive mentor prompts when configured; provider keys are server-side settings and must not be exposed to the browser.

## STRIDE Analysis

| Threat | Example | Current mitigations | Residual risk / follow-up |
| --- | --- | --- | --- |
| **Spoofing** | An attacker guesses credentials or reuses a stolen token to impersonate a learner. | Passwords use Argon2id. Signed JWTs carry a JTI, and active session records support logout revocation. Browser sessions use HttpOnly cookies; authorization is checked server-side. Login attempts are limited by IP and normalized email. | The login limiter is in-memory and scoped to the current process; it is not a distributed limit across workers. Add a shared rate-limit store and consider MFA for higher-risk deployments. Use HTTPS and secure cookie settings behind a correctly configured production proxy. |
| **Tampering** | A client changes a submitted score, replays a lesson completion, or attempts to credit XP to another user. | The server calculates quiz grades. XP writes are handled by grading/progress services, use database transactions, idempotency flags, and unique constraints on source records. User identity comes from the authenticated session, not a client-supplied owner ID. PostgreSQL concurrency tests cover race conditions. | Database credentials and migration privileges must remain server-side and narrowly scoped. Review schema changes and maintain backups and migration rollback procedures. |
| **Repudiation** | A user or operator disputes a login, failed request, or state-changing action. | Request logging records method, path, and response status. Integrity collisions and unhandled errors are logged with server-side context. Session JTI records preserve revocation state. | Current logs are operational application logs, not a tamper-evident audit ledger, and they do not capture every business event. Production should forward structured logs to access-controlled, retained storage and add durable audit events for sensitive actions. Avoid logging credentials, tokens, or unnecessary personal data. |
| **Information Disclosure** | A learner retrieves another user's progress or obtains a quiz answer key before submitting. | Authenticated routes scope data to the current user. Quiz-fetch responses omit correct option IDs and explanations; grading feedback is returned only after submission. Production error handling avoids returning internal exception details. Provider keys are read by the backend from settings. | Enforce TLS in deployment, restrict database/network access, and review provider retention and data-processing terms before sending learner content externally. Do not treat frontend visibility or prompt instructions as confidentiality controls. |
| **Denial of Service** | Repeated login attempts or excessive requests consume API, database, or provider capacity. | Login attempts are rate-limited. Request payloads have schema limits, PostgreSQL connection pooling is bounded, and mentor provider calls have timeouts. | The in-memory login limit is not shared across replicas. General API and mentor endpoints need production-grade distributed quotas, request/concurrency limits, provider budgets, and monitoring. Apply edge-level protection and capacity controls before public exposure. |
| **Elevation of Privilege** | Prompt injection convinces the mentor to award XP, alter a grade, disclose privileged instructions, or act with another user's authority. | The mentor endpoint has no tools or database write path for grades or XP. Deterministic grading and XP services remain separate. The embedded response engine rejects common unauthorized-award and prompt-override requests. Adversarial tests submit malicious prompts and assert XP, grades, and XP ledger records remain unchanged. | Prompt filtering and model refusal are defense-in-depth, not the authorization boundary. External model output can still be incorrect or manipulated; continue to keep privileged operations behind authenticated, validated backend endpoints and test new tool integrations before granting capabilities. |

## Operational Assumptions

- Production secrets are provided through a secret manager or protected environment configuration, never committed to source control.
- PostgreSQL is reachable only by trusted application and administration networks.
- TLS terminates at a trusted proxy or load balancer, with forwarded headers and secure cookies configured accordingly.
- The local Compose stack is for development; its default credentials and key are not suitable for deployment.

## Review Priorities

Before a public production launch, prioritize shared rate limiting, centralized durable audit logging, TLS/proxy configuration review, secret rotation, and provider data-retention review.