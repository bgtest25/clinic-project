# Havenote

Clinical documentation, spoken to structured. A clinician records a patient visit in the browser,
the audio is transcribed, an AI drafts a structured SOAP note, and the clinician reviews, edits,
and signs it.

**Status:** pre-launch, HIPAA-track. No external clinic has signed on as a pilot and no real
patient data has ever been onboarded — everything below describes the system as built and tested,
not live clinical use.

## Architecture

```
Browser → API (NestJS) → S3 (audio) → Step Functions → Transcribe Medical → Claude → ClinicalNote
                ↓
          Postgres (Multi-AZ, RDS) — Clinic, Patient, Encounter, Transcript, ClinicalNote, AuditLog
```

- **`web/`** — React/Vite frontend: recording UI, transcript + editable SOAP note review, sign-off,
  PDF export
- **`api/`** — NestJS backend: Cognito-authenticated routes, Prisma/Postgres, audit logging
- **`infra/`** — AWS CDK (TypeScript): VPC, RDS Multi-AZ + KMS, S3 (SSE-KMS), Cognito (mandatory
  MFA), ECS Fargate, Step Functions, CloudTrail/GuardDuty/Config
- **`compliance/`** — HIPAA Security Risk Assessment, BAA template, retention policy,
  incident-response runbook, and the outreach materials used to request an independent security
  review

## What's actually been verified, not just built

- Formal internal HIPAA Security Risk Assessment across 10 threat categories, cross-checked
  against the HHS/ONC Security Risk Assessment Tool
- 13 of 15 known dependency vulnerabilities fixed; AWS Inspector enabled
- A real session-security gap (30-day token default leaving signed-in devices with standing
  access) found and closed
- A full point-in-time database backup-restore drill, confirmed matching data across every table
- A concurrency test held 60 simultaneous authenticated requests with zero errors
- ICD-10 code suggestions grounded in a real code lookup via LLM tool use, not model recall alone
- Two real production outages, including one invisible to standard HTTP health checks, found and
  fixed, with regression tests added so they can't recur silently

Full write-ups live in `compliance/`. Build phases and what's left are in `ROADMAP.md`.

## Running it locally

Each app has its own environment setup:
- `api/` — NestJS + Prisma/Postgres, see `api/.env.example`
- `web/` — Vite/React, see `web/.env.example`
- `infra/` — AWS CDK, `npx cdk synth` / `npx cdk deploy`

## How this was built

Architected and directed via Claude Code, Anthropic's agentic coding tool. Every product,
architecture, security, and compliance decision was made and verified by the author; the tool
executed the implementation.
