"""
Seed script to populate initial modules, lessons, and quizzes.
Provides real cybersecurity educational content for the complete learner journey.
"""

import asyncio
import uuid
from decimal import Decimal
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models import (
    Module, Lesson, Quiz, QuizQuestion, CareerPath, DifficultyLevel
)

SEED_MODULES = [
    {
        "slug": "network-defense-fundamentals",
        "title": "Network Defense & Traffic Analysis",
        "description": "Master core networking protocols, packet inspection, firewalls, and Wireshark traffic analysis for SOC analysts.",
        "career_path": CareerPath.soc_analyst,
        "difficulty": DifficultyLevel.beginner,
        "order_index": 1,
        "xp_reward": 150,
        "lessons": [
            {
                "slug": "osi-model-packet-analysis",
                "title": "The OSI Model & Packet Dissection",
                "content_md": """# The OSI Model & Packet Dissection

In Security Operations (SOC), understanding how network packets traverse the 7 layers of the OSI model is essential for detecting anomalies and diagnosing intrusions.

## Core Protocol Port Mappings
- **Port 80**: HTTP (Cleartext Web Traffic)
- **Port 443**: HTTPS (TLS Encrypted Web Traffic)
- **Port 53**: DNS (Domain Resolution, UDP/TCP)
- **Port 22**: SSH (Encrypted Remote Terminal)

## Detecting Anomalous Handshakes
During a standard TCP 3-way handshake:
1. Client sends `SYN` (Synchronize)
2. Server responds `SYN-ACK` (Synchronize-Acknowledge)
3. Client responds `ACK` (Acknowledge)

A flood of `SYN` packets without completing `ACK` packets suggests a **SYN Flood Denial of Service** attack or port scan (SYN Stealth Scan, `nmap -sS`).
""",
                "order_index": 1,
                "xp_reward": 50,
                "estimated_minutes": 15,
            },
            {
                "slug": "firewall-rules-and-segmentation",
                "title": "Firewalls & Network Segmentation",
                "content_md": """# Firewalls & Network Segmentation

Network segmentation restricts lateral movement by attackers who have gained an initial foothold.

## Stateful vs. Stateless Inspection
- **Stateless Packet Filtering**: Inspects individual packets in isolation based on static rules (source IP, destination IP, port). Easily fooled by spoofed responses.
- **Stateful Inspection**: Maintains an internal state table tracking active connections. Drops inbound packets that do not correspond to an established or related outbound connection.

## Micro-Segmentation Principles
Zero Trust architectures mandate micro-segmentation, ensuring internal hosts cannot communicate freely across VLANs or subnets without strict access control lists (ACLs).
""",
                "order_index": 2,
                "xp_reward": 50,
                "estimated_minutes": 20,
            }
        ],
        "quiz": {
            "slug": "network-defense-quiz",
            "title": "Network Defense Certification Quiz",
            "description": "Demonstrate your understanding of packet analysis and firewall defense mechanisms.",
            "passing_score": Decimal("70.0"),
            "max_attempts": 3,
            "xp_reward": 100,
            "questions": [
                {
                    "question_text": "What type of scan leaves connections half-open to avoid being logged by naive application listeners?",
                    "options": [
                        {"id": "a", "text": "TCP Full Connect Scan (-sT)"},
                        {"id": "b", "text": "TCP SYN Stealth Scan (-sS)"},
                        {"id": "c", "text": "UDP Broadcast Scan (-sU)"},
                        {"id": "d", "text": "Ping Sweep (-sn)"}
                    ],
                    "correct_option_id": "b",
                    "explanation": "A SYN scan (half-open scan) sends a SYN and resets the connection with RST upon receiving SYN-ACK, never completing the full 3-way handshake.",
                    "points": 1,
                    "order_index": 1,
                },
                {
                    "question_text": "Which port does secure DNS over HTTPS (DoH) commonly use?",
                    "options": [
                        {"id": "a", "text": "53"},
                        {"id": "b", "text": "853"},
                        {"id": "c", "text": "443"},
                        {"id": "d", "text": "80"}
                    ],
                    "correct_option_id": "c",
                    "explanation": "DNS over HTTPS (DoH) encapsulates DNS queries inside standard HTTPS requests over port 443.",
                    "points": 1,
                    "order_index": 2,
                },
                {
                    "question_text": "What is the primary advantage of a stateful firewall over a stateless firewall?",
                    "options": [
                        {"id": "a", "text": "It can decrypt RSA keys on the fly"},
                        {"id": "b", "text": "It tracks active connection states and permits only valid return traffic"},
                        {"id": "c", "text": "It replaces the need for network intrusion detection"},
                        {"id": "d", "text": "It provides full hardware virtualization"}
                    ],
                    "correct_option_id": "b",
                    "explanation": "Stateful firewalls maintain connection tables to ensure incoming responses match legitimate, established outgoing requests.",
                    "points": 1,
                    "order_index": 3,
                }
            ]
        }
    },
    {
        "slug": "web-application-security",
        "title": "Web Application Security (OWASP Top 10)",
        "description": "Deep dive into web vulnerabilities: SQL injection, cross-site scripting (XSS), broken access control, and API defense.",
        "career_path": CareerPath.app_security,
        "difficulty": DifficultyLevel.beginner,
        "order_index": 2,
        "xp_reward": 200,
        "lessons": [
            {
                "slug": "sql-injection-and-parameterization",
                "title": "SQL Injection & Parameterized Queries",
                "content_md": """# SQL Injection & Parameterized Queries

SQL Injection (SQLi) occurs when untrusted user input is concatenated directly into SQL command strings, allowing an adversary to manipulate database logic.

## Vulnerable Pattern
```python
# VULNERABLE: Direct string formatting
query = f"SELECT * FROM users WHERE username = '{user_input}'"
```

## Remediation: Parameterized Queries
```python
# SECURE: Database engine treats input purely as data, never executable code
query = "SELECT * FROM users WHERE username = :username"
await db.execute(select(User).where(User.username == user_input))
```
""",
                "order_index": 1,
                "xp_reward": 50,
                "estimated_minutes": 20,
            }
        ],
        "quiz": {
            "slug": "web-security-quiz",
            "title": "OWASP Web Security Assessment",
            "description": "Test your ability to identify and remediate web application vulnerabilities.",
            "passing_score": Decimal("70.0"),
            "max_attempts": 3,
            "xp_reward": 100,
            "questions": [
                {
                    "question_text": "Which defensive practice completely mitigates classic SQL injection in relational databases?",
                    "options": [
                        {"id": "a", "text": "Client-side form validation"},
                        {"id": "b", "text": "Parameterized queries / prepared statements"},
                        {"id": "c", "text": "Base64 encoding user input"},
                        {"id": "d", "text": "Blocking the apostrophe character with regex"}
                    ],
                    "correct_option_id": "b",
                    "explanation": "Prepared statements ensure that the SQL database interprets input strictly as parameter values, preventing syntax tampering.",
                    "points": 1,
                    "order_index": 1,
                }
            ]
        }
    }
]


async def seed_data():
    print("Starting database seed...")
    async with AsyncSessionLocal() as db:
        for mod_data in SEED_MODULES:
            # Check if module exists
            existing_mod = await db.execute(
                select(Module).where(Module.slug == mod_data["slug"])
            )
            module = existing_mod.scalar_one_or_none()

            if not module:
                module = Module(
                    slug=mod_data["slug"],
                    title=mod_data["title"],
                    description=mod_data["description"],
                    career_path=mod_data["career_path"],
                    difficulty=mod_data["difficulty"],
                    order_index=mod_data["order_index"],
                    xp_reward=mod_data["xp_reward"],
                    is_published=True,
                )
                db.add(module)
                await db.flush()
                print(f"Created module: {module.title}")

            # Seed lessons
            for les_data in mod_data["lessons"]:
                existing_les = await db.execute(
                    select(Lesson).where(Lesson.slug == les_data["slug"])
                )
                if not existing_les.scalar_one_or_none():
                    lesson = Lesson(
                        module_id=module.id,
                        slug=les_data["slug"],
                        title=les_data["title"],
                        content_md=les_data["content_md"],
                        order_index=les_data["order_index"],
                        xp_reward=les_data["xp_reward"],
                        estimated_minutes=les_data["estimated_minutes"],
                        is_published=True,
                    )
                    db.add(lesson)
                    await db.flush()
                    print(f"  Created lesson: {lesson.title}")

            # Seed quiz
            quiz_data = mod_data["quiz"]
            existing_quiz = await db.execute(
                select(Quiz).where(Quiz.slug == quiz_data["slug"])
            )
            quiz = existing_quiz.scalar_one_or_none()
            if not quiz:
                quiz = Quiz(
                    module_id=module.id,
                    slug=quiz_data["slug"],
                    title=quiz_data["title"],
                    description=quiz_data["description"],
                    passing_score=quiz_data["passing_score"],
                    max_attempts=quiz_data["max_attempts"],
                    xp_reward=quiz_data["xp_reward"],
                    is_published=True,
                )
                db.add(quiz)
                await db.flush()
                print(f"  Created quiz: {quiz.title}")

                for q_item in quiz_data["questions"]:
                    question = QuizQuestion(
                        quiz_id=quiz.id,
                        question_text=q_item["question_text"],
                        options=q_item["options"],
                        correct_option_id=q_item["correct_option_id"],
                        explanation=q_item["explanation"],
                        points=q_item["points"],
                        order_index=q_item["order_index"],
                    )
                    db.add(question)
                await db.flush()
                print(f"    Added {len(quiz_data['questions'])} quiz questions")

        await db.commit()
    print("Database seeding completed successfully!")


if __name__ == "__main__":
    asyncio.run(seed_data())
