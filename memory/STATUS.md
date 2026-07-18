# Havenote — Project Status

**Last updated:** 2026-07-18 (end of session)

This file is the single source of truth for "where did we leave off." Read this first when
resuming work — it's kept up to date at the end of every substantial session. For the full
build plan, see `../ROADMAP.md`. For AWS-account-specific details (nameservers, resource IDs,
verification commands), see ROADMAP.md's "Account baseline status" and "Media bucket encryption
decision" sections.

## 🔴 Blocked — waiting on something outside this repo

1. **Bedrock model access** — AWS support case filed, still pending as of last check. The AI
   pipeline runs in **mock mode** (`MOCK_SOAP_NOTE=true`, default in `infra/bin/infra.ts`) —
   every draft note is clearly labeled `[MOCK NOTE — Bedrock access pending]`, not real AI output.
   - Check status: `aws bedrock get-foundation-model-availability --model-id anthropic.claude-sonnet-5 --profile clinic-project --region us-east-1` — look for `authorizationStatus: AUTHORIZED`.
   - Once cleared: flip the default in `infra/bin/infra.ts` (`mockSoapNote`) to `false`, then
     `cd infra && npx cdk deploy ClinicAiPipelineStack --profile clinic-project`.

2. **CloudFront account verification** — AWS support case filed, still pending. Blocks the
   frontend (`ClinicWebHostingStack`: S3 + CloudFront for `havenote.health` / `app.havenote.health`)
   from deploying at all. The `deploy-web.yml` CI pipeline is fully built and will auto-retry on
   the next push touching `web/**` — it just needs AWS to clear this first.
   - Check status: try `cd infra && npx cdk deploy ClinicWebHostingStack --profile clinic-project` —
     if it still 403s with "Your account must be verified," it's still pending.
   - If it fails, clean up before retrying: the stack lands in `ROLLBACK_COMPLETE` and the
     `clinic-project-web-*` S3 bucket survives (RemovalPolicy.RETAIN) — delete the stack
     (`aws cloudformation delete-stack --stack-name ClinicWebHostingStack`) and the empty bucket
     before trying again, or the retry will collide on the bucket name.

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

## Known gaps, not blocking, not started

- `RETENTION-POLICY.md`'s own open items: minimum retention period per state law (not just the
  expiration rules already built), patient-deletion request flow, account offboarding.
- `GET /clinics` (list all clinics) isn't clinic-scoped — low severity, no PHI in that model
  (just clinic names), not fixed.
- AWS Config's S3 bucket lifecycle configuration was never verified.

## How to resume in a new session

Just ask "what's left" or "where did we leave off" — this file plus the external memory system
(tied to this project directory) should make that answer immediate. If either AWS support case
has cleared, that's almost certainly the next thing to act on.
