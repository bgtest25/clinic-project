# Havenote — Build Roadmap

Rough total: 8–12 weeks solo, with Phase 2 as the most likely place to run long.

## Phase 0 — AWS Foundation & Account Setup (3–5 days)

- Dedicated AWS account for this project, root MFA locked down, scoped IAM deploy role (no root-account daily use)
- Sign the AWS BAA via AWS Artifact first — this gates everything else that will touch real PHI, no reason to wait
- VPC via AWS CDK (TypeScript, so infra code lives in the same language as the app) — public/private subnets, NAT gateway
- CloudTrail (account-wide trail to a dedicated log bucket), GuardDuty, AWS Config turned on
- Secrets Manager conventions established
- **Deliverable**: an account that could pass a basic security review before a single line of product code exists

## Phase 1 — Core Infra Skeleton (1 week)

- CDK stacks: RDS Postgres Multi-AZ + KMS key, S3 buckets (SSE-KMS + lifecycle rules) for audio/PDFs, Cognito user pool with clinician/admin groups, ECS cluster + Fargate service + ALB + ACM + Route53
- Prisma schema + migrations: Clinic, User, Patient, Encounter, AudioRecording, Transcript, ClinicalNote, AuditLog
- Basic NestJS API: health check, Cognito-authenticated routes, Clinic/Patient/Encounter CRUD
- GitHub Actions → ECR → ECS deploy pipeline
- **Deliverable**: an empty-but-real app, deployed, behind real auth, on real AWS infra

## Phase 2 — Recording → AI Pipeline (2–3 weeks, the long pole)

- Web recording UI (consent capture step first) wired to Cognito
- Presigned S3 upload for audio
- Step Functions state machine: S3 upload event → Transcribe Medical job → Lambda step builds the Bedrock prompt from the transcript → Bedrock InvokeModel (Claude) → parse SOAP JSON → write ClinicalNote → notify
- Heavy iteration on the Bedrock prompt against real/sample transcripts — budget the most time here, this is what decides whether the note actually reads like a real clinical note
- **Deliverable**: record a visit, get a usable draft SOAP note out the other end, traceable end-to-end through Step Functions

## Phase 3 — Review, Sign-off, Export (1–2 weeks)

- Review/edit UI: transcript beside editable SOAP fields
- Every edit → an AuditLog row (append-only)
- Sign action locks the note, records signer + timestamp; later changes become versioned amendments, never silent overwrites
- PDF export + copy-to-clipboard, encounter dashboard/list view
- **Deliverable**: the full loop, recording to a signed, exportable note

## Phase 4 — Compliance Hardening & Pilot Prep (1–2 weeks)

- Security pass: confirm every PHI-touching service is HIPAA-eligible, KMS encryption verified everywhere, least-privilege IAM audit
- S3 lifecycle rule to auto-delete raw audio after a configurable window post-sign-off
- Draft the BAA you'll sign with the pilot clinic (you're the business associate, they're the covered entity)
- Retention/deletion policy, privacy policy, lightweight incident-response runbook
- **Deliverable**: ready for a real clinic to put real patient data through this

## Phase 5 — Pilot

- Onboard one clinic, 1–2 clinicians; shadow real visits; tune Bedrock prompts on real feedback
- Track time-saved-per-note and clinician satisfaction — this becomes your case study for the next clinic, and eventually hospitals
