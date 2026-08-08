# Havenote — Project Status

**Last updated:** 2026-08-08 (mid-session — Business Support enabled, new CloudFront case opened)

This file is the single source of truth for "where did we leave off." Read this first when
resuming work — it's kept up to date at the end of every substantial session. For the full
build plan, see `../ROADMAP.md`. For AWS-account-specific details (nameservers, resource IDs,
verification commands), see ROADMAP.md's "Account baseline status" and "Media bucket encryption
decision" sections.

## 🔴 Blocked — waiting on something outside this repo

1. **Bedrock model access** — still `NOT_AUTHORIZED` as of 2026-08-08. Case `178433501800988`:
   a genuine past-due balance ($53.76) was found and paid 2026-08-08 (the agent's request for
   payment was legitimate — confirmed via the real case correspondence, not phishing, despite an
   unusually warm tone), and the case was replied to confirming payment. Status now
   `customer-action-completed` — waiting on the agent to submit the actual activation request next.
   The AI pipeline runs in **mock mode** (`MOCK_SOAP_NOTE=true`, default in `infra/bin/infra.ts`) —
   every draft note is clearly labeled `[MOCK NOTE — Bedrock access pending]`, not real AI output.
   The system prompt itself was hardened 2026-07-21 (see below) and is already deployed — nothing
   left to do here code-side once access clears.
   - Check status: `aws bedrock get-foundation-model-availability --model-id anthropic.claude-sonnet-5 --profile clinic-project --region us-east-1` — look for `authorizationStatus: AUTHORIZED`.
   - **Account upgraded to Business Support 2026-08-08** — `aws support describe-cases --profile clinic-project --region us-east-1 --include-resolved-cases --max-results 10` now works (previously threw `SubscriptionRequiredException` on Basic support) and is the better way to check real case status/correspondence, not just the raw Bedrock API 403.
   - Once cleared: flip the default in `infra/bin/infra.ts` (`mockSoapNote`) to `false`, then
     `cd infra && npx cdk deploy ClinicAiPipelineStack --profile clinic-project`.

2. **CloudFront account verification** — the *original* case (`178440028900396`) was actually
   **denied and closed 2026-07-28** ("unable to approve the verification request at this time...
   resubmit once the account has more usage/billing history") — this wasn't visible until Business
   Support was enabled 2026-08-08 and gave API access to case correspondence; every re-check
   between 7/28 and 8/8 was correctly hitting the 403 because there was no longer an active case,
   not because it was "still pending." **New case opened 2026-08-08**:
   `case-501264525435-muen-2026-de7f9790e656deb8`, referencing the denial and citing since-then
   account history (cleared past-due balance, Business Support upgrade, continued real usage
   across RDS/ECS/S3/Lambda/Step Functions/Cognito). Blocks the frontend (`ClinicWebHostingStack`:
   S3 + CloudFront for `havenote.health` / `app.havenote.health`) from deploying at all. The
   `deploy-web.yml` CI pipeline is fully built and correctly auto-retries on every push touching
   `web/**` — it just needs AWS to approve this first.
   - Check status: prefer `aws support describe-cases --profile clinic-project --region us-east-1 --include-resolved-cases --max-results 10` and look at case `de7f9790e656deb8`'s correspondence directly — this is what revealed the *original* case had been silently denied/closed weeks before anyone noticed, since a raw 403 alone can't distinguish "still pending" from "denied, no active case." The `cdk deploy ClinicWebHostingStack --profile clinic-project` attempt still works as a live functional check, just don't treat its 403 alone as proof the case is still open.
   - If it fails, clean up before retrying: the stack lands in a rollback/review state and the
     `clinic-project-web-*` S3 bucket survives (RemovalPolicy.RETAIN) — delete the stack
     (`aws cloudformation delete-stack --stack-name ClinicWebHostingStack`, then
     `aws cloudformation wait stack-delete-complete ...`) and the empty bucket
     (`aws s3api delete-bucket --bucket clinic-project-web-501264525435`) before trying again, or
     the retry will collide on the bucket name.

3. **Legal review** — `compliance/BAA-TEMPLATE.md` and `compliance/PRIVACY-POLICY.md` are drafts,
   explicitly **not reviewed by counsel, not ready to sign/publish**. Needed before any real
   clinic/patient data goes through this system. Not an engineering task — needs the user to
   confirm this has happened.

## What's actually done (verified live, not just written)

- **Phases 0–4**: essentially complete. Full CDK infra (network/database/auth/storage/registry/
  compute/AI-pipeline/DNS/web-hosting), RDS Multi-AZ + KMS, media bucket on SSE-KMS
  (customer-managed key), event-driven audio retention policy, CloudTrail/GuardDuty/Config
  confirmed enabled (account baseline, not managed by this repo's CDK), 4 compliance documents
  drafted.
- **Phase 3** (review/sign/export): full `notes` module, PDF export, dashboard, and a real
  design-system pass across the whole `web/` frontend.
- **Phase 5** (pilot prep), everything not blocked on the two AWS cases above:
  - `api.havenote.health` is live over HTTPS (verified: `/health` → 200, HTTP redirects to HTTPS).
  - Clinician onboarding: admin-invite flow (`POST /users`) + the first-login
    set-password/MFA-setup flow.
  - Metrics: satisfaction-rating widget + admin metrics dashboard (review time, edit count,
    satisfaction).
- **Security fix**: found and fixed a real cross-clinic data leak — every service
  (patients/encounters/recordings/notes/metrics) now scopes to the caller's own clinic instead of
  trusting client-supplied IDs.
- **Test coverage**: went from 1 test (health-check e2e) to 26 tests across 4 suites, wired into
  CI as a real gate before build/deploy (two latent CI gaps found and fixed in the process:
  missing `prisma generate` and missing e2e `DATABASE_URL`).
- **Frontend CI/CD**: `deploy-web.yml` exists and is verified to run correctly up to the known
  CloudFront blocker.
- **Minimum retention period confirmed** (2026-07-19): pilot clinic is in Pennsylvania — 49 Pa.
  Code § 16.95 requires ≥7 years from last visit (longer for minors). Indefinite retention of
  `clinical_notes`/`transcripts` (already-built, no auto-deletion) satisfies this. See
  `compliance/RETENTION-POLICY.md`.
- **Patient-initiated deletion/amendment requests** (2026-07-19): log-and-route-for-review flow —
  `POST`/`GET`/`PATCH /patients/:id/data-requests` — deliberately never deletes/anonymizes data
  (HIPAA only grants a right to *request* amendment, and PA's retention floor above forbids
  outright deletion anyway). New `PatientDataRequest` model + two new `AuditLog` action strings.
- **Account offboarding** (2026-07-19): `PATCH /users/:id/deactivate` / `.../reactivate`
  (admin-only, own-clinic-only) — disables the Cognito user + signs out active sessions +
  flags `User.deactivatedAt`. Never hard-deletes the row (would orphan
  `ClinicalNote.signedById`/`AuditLog.actorId`). `UsersService.findByCognitoSub` now rejects a
  deactivated caller everywhere in one place, since every clinic-scoped service resolves the
  caller through it first.
- **`GET /clinics` clinic-scoping fix** (2026-07-19): now returns only the caller's own clinic;
  `GET /clinics/:id` 404s on any other clinic's id.
- **AWS Config S3 bucket lifecycle** (2026-07-19): `config-bucket-501264525435` had no lifecycle
  rule at all (unbounded growth) — applied a 365-day expiration rule directly via
  `aws s3api put-bucket-lifecycle-configuration` (account-baseline bucket, not CDK-managed),
  matching the CloudTrail bucket's existing retention. Verified live.
- **Admin/patient UI** (2026-07-21): the `deactivate`/`reactivate`/data-request/`GET /clinics`
  endpoints from 2026-07-19 had zero frontend coverage until now. Added `GET /users` (new
  backend endpoint — a roster to actually manage), `Users`/`Patients`/`PatientDetail` pages, a
  small shared `ConfirmButton` inline-confirm component (no modal — this app has none), and the
  clinic name in the topbar. Deployed (the `GET /users` backend piece; the frontend itself can't
  deploy yet — see CloudFront blocker above).
- **Web test infrastructure** (2026-07-21): `web/` had zero test tooling before this — no script,
  no files. Vitest + React Testing Library now set up; grew from 38 to **55 tests across 10 files**
  same day, once `NewEncounter.tsx`/`Metrics.tsx`/`NoteReview.tsx` coverage was added too. Every
  page now has coverage except `Login.tsx` (Cognito SDK depth) and `Recording.tsx`
  (MediaRecorder/getUserMedia, not implemented in jsdom) — both deliberately excluded, not deferred.
- **SOAP-note prompt hardened** (2026-07-21): replaced the single generic paragraph with
  field-specific guidance (what belongs in each SOAP section, explicit handling of
  incomplete/garbled transcript segments, tightened anti-hallucination/output-format rules).
  Validated against synthetic urgent-care transcripts via a mocked-Bedrock Jest suite (live
  Bedrock still blocked). Deployed to `ClinicAiPipelineStack` already — inert until Bedrock
  access clears and `MOCK_SOAP_NOTE` flips off.
- **Real production bug found + fixed via a live smoke test** (2026-07-21): deactivate/reactivate
  was 500ing in production — the ECS task role's IAM grant never got the
  `AdminDisableUser`/`AdminEnableUser`/`AdminUserGlobalSignOut` actions the 2026-07-19 session's
  code needed. Invisible to unit tests (they mock the Cognito SDK client), only caught by running
  the actual app against the real API. Fixed in `infra/lib/compute-stack.ts`, redeployed, verified
  clean end-to-end with zero console errors. A follow-up audit of every other AWS SDK call in
  `api/src/**` and `infra/lambda/**` against their actual IAM grants found **no other instances**
  of this bug class — this was an isolated gap, not a systemic pattern.
- **Data-request resolution note now displayed** (2026-07-21): the note captured on approve/deny
  was written to the DB but never shown anywhere afterward — added a Resolution column to
  `PatientDetail.tsx`.
- **11 more synthetic-transcript scenarios added** (2026-08-08, three passes): `generate-soap-note.test.ts`
  grew from 3 to 14 transcript fixtures (5→16 tests). First pass: pediatric single-complaint
  (guardian-reported otitis media), multi-complaint adult (unrelated back pain + med refill),
  pediatric multi-complaint (fever + rash), adolescent confidential (guardian steps out, direct
  suicidality screening). Second pass: medication reconciliation (nonadherence gap + undisclosed OTC
  use), telehealth/limited-exam visit (asserts the note doesn't invent physical-exam findings a
  video visit can't produce), informed refusal (patient declines an ER referral — asserts the plan
  documents the refusal and return precautions rather than dropping the recommendation). Third pass,
  enterprise/security-oriented: **prompt-injection resistance** (transcript contains instruction-like
  text trying to get the model to leak its system prompt or other patients' data — this one drove an
  actual prompt change, see below, not just a test), AMA departure (formal against-medical-advice
  documentation, distinct from generic informed refusal), a sensitive safety disclosure (domestic
  violence — factual/non-judgmental documentation + resources offered, asserts no invented legal
  conclusions), and an interpreter-assisted visit (asserts history is attributed to the patient via
  the interpreter, not blended as the interpreter's own voice). Same pattern throughout:
  mocked-Bedrock only, since live Bedrock is still blocked — these document expected behavior for
  replay against the real model once access clears.
- **SOAP system prompt hardened again** (2026-08-08): added an explicit rule instructing the model to
  treat all transcript content as reported speech, never as instructions to it — closes a real gap
  found while building the prompt-injection test (the 2026-07-21 hardening pass covered
  hallucination/incomplete-transcript handling but never addressed embedded-instruction resistance).
  Deployed as part of `ClinicAiPipelineStack` (inert until Bedrock access clears, same as the rest of
  the prompt).
- **Pilot onboarding runbook written** (2026-08-08): `compliance/PILOT-ONBOARDING-RUNBOOK.md` —
  documents the actual built flow end to end (there's no self-signup, so the very first clinic/admin
  has to be bootstrapped manually via a one-off ECS task, same pattern already proven for the
  `testclinician` test account), clinician invite → first-login MFA setup → the full
  record→review→sign→export workflow, admin operations, and a pre-launch checklist tied to the two
  open AWS blockers plus legal sign-off.

## Known gaps, not blocking, not started

- None currently open — the last remaining gap (more synthetic-transcript scenarios) was closed
  2026-08-08 below.

## How to resume in a new session

Just ask "what's left" or "where did we leave off" — this file plus the external memory system
(tied to this project directory) should make that answer immediate. If either AWS support case
has cleared, that's almost certainly the next thing to act on.
