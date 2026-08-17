# Havenote — Independent Security Review Scope

**Purpose:** a starting map for whoever performs the independent security review this project
needs before real patient data goes through it. This was deliberately not written by anyone who
built or reviewed the system — self-review, however thorough, isn't a substitute for this, which
is exactly why this document hands off rather than concludes. Everything below is current as of
2026-08-16; verify it's still accurate before relying on it, since this system continues to change.

## What Havenote is

A clinical documentation SaaS: a clinician records a patient visit in-browser, the audio is
transcribed (AWS Transcribe Medical), an AI drafts a structured SOAP note (Anthropic Claude,
called directly via API), the clinician reviews/edits/signs it, and it's exported. Pre-launch,
single-tenant architecture — no external clinic has been signed as a pilot partner yet (the one
clinic row in the system is internal test data), and real patient data has not been onboarded
anywhere (blocked on legal review, see
`compliance/BAA-TEMPLATE.md`).

## Live URLs

- `https://havenote.health` and `https://app.havenote.health` — frontend (React SPA, hosted on
  Vercel as an interim measure — see "Known non-standard architecture" below)
- `https://api.havenote.health` — backend API (NestJS on AWS ECS Fargate, behind an ALB)

## Attack surface

**Authentication**
- AWS Cognito user pool, email + password + mandatory TOTP MFA. No self-signup — accounts are
  admin-provisioned only (`infra/lib/auth-stack.ts`)
- Frontend uses `amazon-cognito-identity-js` directly against Cognito — the API itself never
  handles credentials
- Access tokens: 30 min validity. Refresh tokens: 12 hours. (Tightened 2026-08-16 from Cognito's
  30-day default — see `memory/STATUS.md` for why)
- Session-side: 15-minute client idle timeout with a resume-check against a persisted timestamp
  (`web/src/auth/useIdleTimer.ts`)

**Authorization**
- Two roles: `admin`, `clinician`, enforced via Cognito groups
- Backend: every protected route requires a JWT independently re-verified against Cognito's public
  keys (`api/src/auth/cognito-auth.guard.ts`), then role-checked against the verified
  `cognito:groups` claim (`api/src/auth/roles.guard.ts`) — not client-supplied data
- Frontend: route guards exist as defense-in-depth (`web/src/App.tsx`'s `AdminRoute`) but are not
  the actual security boundary — the backend is

**API surface** (NestJS, `api/src/`) — modules: `clinics`, `patients`, `patient-data-requests`,
`encounters`, `recordings`, `users`, `notes`, `metrics`, `health`. All clinic-scoped data access
resolves the caller's clinic via their JWT and filters every query by it
(`UsersService.findByCognitoSub` is the chokepoint most services call first).

**Data flows to third parties**
- **AWS Transcribe Medical** — receives raw audio, returns a transcript (text + speaker-diarized
  segments). Covered by the active AWS BAA.
- **Anthropic API** (`api.anthropic.com`, called directly from `infra/lambda/process-transcript/index.ts`,
  not via Bedrock) — receives the transcript text (real PHI: patient statements, symptoms,
  history) to draft the SOAP note. **No BAA currently in place with Anthropic** — see
  `compliance/ANTHROPIC-DATA-FLOW-SUMMARY.md` for the exact data sent.
- No other third party receives PHI. The ICD-10 code lookup used by the AI pipeline's tool-use step
  is a local, self-hosted dataset bundled into the Lambda — deliberately not a third-party API, to
  avoid a new subprocessor relationship.

**Infrastructure** (AWS account `501264525435`, `us-east-1`)
- VPC with public/private-app/private-data subnets
- RDS Postgres 16.4, Multi-AZ, KMS-encrypted, `db.t4g.micro`
- ECS Fargate (API), ALB in front, single task (no autoscaling configured)
- S3 media bucket, SSE-KMS with a customer-managed key, presigned-URL uploads from the browser
- Lambda (`clinic-project-process-transcript`) + Step Functions state machine orchestrating the
  Transcribe → AI-draft pipeline
- Cognito user pool `us-east-1_odhVx41g7`
- CloudTrail, GuardDuty, AWS Config (16 managed rules) all enabled and recording
- 11 CloudWatch alarms → SNS → confirmed-working email alert

## Known non-standard architecture (worth understanding before testing)

- **Frontend is on Vercel, not the AWS-native CloudFront stack the code actually defines**
  (`ClinicWebHostingStack` exists in `infra/lib/`, deployed nowhere right now). This is a
  workaround for an AWS account-age-based CloudFront restriction, tracked as an open AWS support
  case. Functionally live and verified, but worth knowing the "real" intended architecture is
  currently dormant code.
- **AI drafting goes through Anthropic's API directly, not Bedrock**, for the same reason
  (a separate blocked AWS support case, Bedrock model access). Same caveat as above.

## Things already found and fixed this project (don't waste time rediscovering these — verify
they're still actually fixed, but they're not undiscovered territory)

- A cross-clinic data leak in patients/encounters/recordings/notes/metrics (found and fixed
  2026-08-11)
- Missing CORS on the apex domain and the media bucket (found and fixed 2026-08-14)
- A stale-route bug that let a non-admin land on an admin-only page after a same-tab login
  (frontend-only — the backend correctly rejected the actual action; fixed 2026-08-15)
- A 30-day Cognito refresh-token window that left sessions silently valid far longer than
  intended, plus a client-side idle timer that could fail to fire on a backgrounded mobile tab,
  plus a "sign out" that only cleared local storage without revoking the session server-side (all
  found and fixed 2026-08-16)
- No rate limiting existed on the API at all (found and fixed 2026-08-16)
- An SNS alert subscription that had silently expired and gone unconfirmed for 5 days, meaning
  zero of the 10 existing CloudWatch alarms could actually reach anyone (found and fixed
  2026-08-16)
- A Prisma `Decimal`-to-JSON-string bug that crashed the `/metrics` page to a blank white screen
  for any authenticated admin, with no error boundary anywhere in the app to catch it (found and
  fixed 2026-08-16)

## What hasn't been tested by anyone, as far as this document's authors know

- Anything requiring genuine adversarial testing (this project's own verification work was always
  testing "does the intended behavior work," not "can this be broken")
- Real concurrent multi-tenant load (only ever tested with disposable single-clinic data)
- The mobile/responsive experience under real network conditions
- Anything about the Vercel or Anthropic-direct interim architectures specifically, versus the
  AWS-native design the code was originally built for
