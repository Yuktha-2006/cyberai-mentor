"""
Onboarding assessment router.
Scores the assessment deterministically server-side and saves domain scores to user profile.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import UserProfile, AssessmentResult, CareerPath, DifficultyLevel
from app.routers.auth import CurrentUser

router = APIRouter(prefix="/api/v1/onboarding", tags=["onboarding"])

# ── Answer key (server-side only, NEVER sent to client) ──────────────────────
ANSWER_KEY: dict[str, str] = {
    "q1": "b",   # HTTPS = 443
    "q2": "b",   # Stateful firewall tracks connection state
    "q3": "b",   # SQL Injection = A03: Injection
    "q4": "c",   # Reflected input without encoding = XSS
    "q5": "b",   # NIST IR first step = Preparation
    "q6": "c",   # 500 SSH fails = Brute force
    "q7": "b",   # Quantum-resistant = CRYSTALS-Kyber
    "q8": "c",   # Tamper detection = Integrity
    "q9": "b",   # AWS access control = IAM
    "q10": "b",  # Least privilege = minimum needed permissions
}

QUESTION_DOMAINS: dict[str, str] = {
    "q1": "network_security",
    "q2": "network_security",
    "q3": "web_security",
    "q4": "web_security",
    "q5": "incident_response",
    "q6": "incident_response",
    "q7": "cryptography",
    "q8": "cryptography",
    "q9": "cloud_security",
    "q10": "cloud_security",
}


class AssessmentSubmission(BaseModel):
    career_path: str
    experience_level: str
    answers: dict[str, str]  # {question_id: selected_option_id}


class AssessmentResponse(BaseModel):
    domain_scores: dict[str, float]
    career_path: str
    experience_level: str
    message: str


@router.post("/assessment", response_model=AssessmentResponse)
async def submit_assessment(
    body: AssessmentSubmission,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> AssessmentResponse:
    """
    Score the onboarding assessment deterministically.
    Domain scores are stored on the user profile.
    The answer key is NEVER sent to the client.
    """
    # Validate career path
    try:
        career = CareerPath(body.career_path)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid career path: {body.career_path}")

    # Validate experience level
    try:
        exp = DifficultyLevel(body.experience_level)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid experience level: {body.experience_level}")

    # ── Deterministic scoring per domain ─────────────────────────────────────
    domain_correct: dict[str, int] = {}
    domain_total: dict[str, int] = {}

    for qid, correct_opt in ANSWER_KEY.items():
        domain = QUESTION_DOMAINS[qid]
        domain_total[domain] = domain_total.get(domain, 0) + 1
        if body.answers.get(qid) == correct_opt:
            domain_correct[domain] = domain_correct.get(domain, 0) + 1

    domain_scores: dict[str, float] = {
        domain: round((domain_correct.get(domain, 0) / total) * 100, 1)
        for domain, total in domain_total.items()
    }

    # ── Save to profile ───────────────────────────────────────────────────────
    profile_result = await db.execute(
        select(UserProfile).where(UserProfile.user_id == current_user.id)
    )
    profile = profile_result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="User profile not found")

    profile.career_path = career
    profile.experience_level = exp
    profile.domain_scores = domain_scores
    profile.onboarding_data = body.answers
    profile.onboarding_completed = True

    # Save individual domain assessment results (idempotent via unique constraint)
    for domain, score in domain_scores.items():
        existing = await db.execute(
            select(AssessmentResult).where(
                AssessmentResult.user_id == current_user.id,
                AssessmentResult.domain == domain,
            )
        )
        result = existing.scalar_one_or_none()
        if result:
            result.score = score  # type: ignore[assignment]
        else:
            db.add(AssessmentResult(user_id=current_user.id, domain=domain, score=score))  # type: ignore[arg-type]

    return AssessmentResponse(
        domain_scores=domain_scores,
        career_path=career.value,
        experience_level=exp.value,
        message="Assessment complete! Your learning path has been personalized.",
    )
