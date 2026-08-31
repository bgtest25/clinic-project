# Havenote — Pilot Onboarding Runbook

**Status:** operational draft, last brought current 2026-08-31. Not legally reviewed — see
`BAA-TEMPLATE.md` / `PRIVACY-POLICY.md` for what's still pending counsel. Both AWS blockers that
originally forced interim workarounds have since cleared: CloudFront cutover completed 2026-08-19
(frontend off Vercel), and Bedrock access confirmed 2026-08-31 (AI drafting off the direct
Anthropic API). See `../memory/STATUS.md` for the full history.

## 0. Pre-launch checklist

**Legal / compliance — the actual remaining gates, none completable by engineering alone:**
- [ ] `compliance/BAA-TEMPLATE.md` and `compliance/PRIVACY-POLICY.md` reviewed by counsel and
      signed with the pilot clinic — see `compliance/LEGAL-REVIEW-COVER-MEMO.md` for a reviewer
      orientation
- [ ] Pilot clinic's actual name/address/state confirmed (retention rules in `RETENTION-POLICY.md`
      are Pennsylvania-specific — re-verify if the pilot clinic isn't in PA)
- [x] ~~A BAA/DPA executed directly with Anthropic~~ — **no longer needed as of 2026-08-31**: AI
      drafting now calls the model through AWS Bedrock instead of Anthropic's API directly, so
      Anthropic is no longer a subprocessor of this system; the existing AWS BAA covers this data
      flow. See `compliance/ANTHROPIC-DATA-FLOW-SUMMARY.md` (now superseded) for the direct-API
      architecture this replaced
- [ ] A formal, documented HIPAA Security Risk Assessment — `compliance/SECURITY-RISK-ASSESSMENT.md`
      is complete with likelihood/impact/risk ratings (signed 2026-08-16, revised 2026-08-31); the
      HHS/ONC SRA Tool cross-check is genuinely in progress, not just prepped — 79/125 questions
      answered in the real downloaded workbook (`compliance/SRA-Tool-v3.6.1-Partial.xlsx`), the
      remaining ~46 are judgment calls only you can make. Sign-off checkbox stays unchecked until
      those are done
- [ ] An independent security review / penetration test, by someone who wasn't involved in
      building the system — see `compliance/SECURITY-REVIEW-SCOPE.md`

**Done:**
- [x] `INCIDENT-RESPONSE-RUNBOOK.md` roles filled in (2026-08-16)
- [x] AWS BAA confirmed active (`aws artifact list-customer-agreements`, effective 2026-07-17)
- [x] AI pipeline genuinely live, non-mock, verified with real transcripts (2026-08-14/15)
- [x] Frontend live on `havenote.health`/`app.havenote.health` via CloudFront (cut over from
      Vercel 2026-08-19)
- [x] AI pipeline switched from direct Anthropic API to AWS Bedrock, verified via a real deployed-
      Lambda invocation (2026-08-31)

## 1. Bootstrap the first clinic + admin (one-time, manual)

There is no self-signup and no UI for creating the very first clinic or admin — every path in the
app (`POST /clinics`, `POST /users`) requires an already-authenticated admin. The very first one has
to be created directly against the database and Cognito, the same way the `testclinician` test
account was seeded during Phase 2 development:

1. Insert the `Clinic` row directly via Prisma (name, address, etc.).
2. Create the Cognito user: `AdminCreateUserCommand` (email, name attributes, `DesiredDeliveryMediums: ['EMAIL']` sends Cognito's own invite email with a temp password) against user pool
   `us-east-1_odhVx41g7`, then `AdminAddUserToGroupCommand` into the `admin` group.
3. Insert the matching `User` row (`cognitoSub` from step 2's response, `role: 'ADMIN'`, the new
   clinic's id).

Run all three from inside the VPC — a one-off ECS task against the `clinic-project-cluster` running
the real API image (same pattern `deploy-api.yml`'s migration step uses: `register-task-definition`
with a command override, `run-task`, `wait tasks-stopped`) is the proven way to reach both RDS
(private-isolated subnet) and Cognito with the right IAM role. Do **not** reuse the `testclinician`
account for the real pilot — that's test debris (see `../memory/STATUS.md`), create a real admin
tied to the actual pilot clinic.

## 2. Admin invites clinicians

From here on it's self-service through the app:

1. Admin logs into `app.havenote.health`, goes to **Users**, uses the invite flow (`InviteClinician`
   page → `POST /users`). Cognito sends the new clinician a temp password by email.
2. Repeat per clinician. Roles are `ADMIN` or `CLINICIAN` — pick based on who needs the Users/Metrics
   admin views vs. just the visit workflow.

## 3. Clinician first login

1. Clinician goes to the login page, enters the emailed temp password.
2. **Forced password reset** (Cognito `NEW_PASSWORD_REQUIRED` challenge) — sets a permanent password.
3. **Mandatory MFA setup** (the user pool requires it, no way to skip) — the app shows a scannable
   QR code plus the raw secret as text, to add to an authenticator app (Google Authenticator, Authy,
   1Password all work), then confirms with the 6-digit code. After first-time setup, subsequent
   logins just prompt for the 6-digit code.

Worth walking the pilot clinic's staff through this live once — MFA setup is the one step in the
whole flow most likely to trip up a non-technical first-time user.

**Clinician without a smartphone**: Cognito's MFA here is standard TOTP (RFC 6238) — it works
identically whether the code comes from a phone app or a seedable hardware TOTP token/fob (e.g.
Protectimus-style, or a YubiKey programmed via its own companion app). Scan or enter the same
QR/secret from the setup screen into the hardware token instead of a phone app; everything else in
the flow is unchanged. **Important**: it must be a *seedable* token that accepts an arbitrary
secret — a pre-configured fixed-seed token (old-style RSA SecurID hardware) cannot work here, since
Cognito always generates a fresh random secret per user at enrollment and there's no way to
register a factory-fixed hardware secret into it.

**Lost token / needs a fresh MFA enrollment**: an admin can trigger this from **Users** → find the
clinician's row → **Reset MFA**. There's no way to clear just the authenticator enrollment on its
own — Cognito's admin API has no "un-enroll this TOTP device" call, only delete-and-recreate the
Cognito user, so this action always also issues a brand-new temporary password via the same
branded invite email the original invite used. The clinician goes through the same first-login
flow above again (temp password → new permanent password → new MFA setup) as if freshly invited.

## 4. Day-to-day clinician workflow

1. **Start a visit**: "Start a new visit" → patient name + date of birth → creates the `Patient` and
   `Encounter` records.
2. **Consent**: explicit "I confirm consent was given" step — must be clicked before recording is
   allowed. This is logged (`consentCapturedAt`), not just a UI gate.
3. **Record**: tap to start/stop. Browser mic capture (`MediaRecorder`), foreground-only — closing
   the tab or navigating away mid-recording loses the recording, there's no background capture.
4. **Upload + processing**: automatic on stop — presigned S3 upload, then the visit shows
   "Processing in the background" while Transcribe Medical → Bedrock run (polls every 4s). This
   typically takes under a minute for a normal-length visit based on Phase 2 testing.
5. **Review**: draft SOAP note (Subjective/Objective/Assessment/Plan + suggested codes) shown next to
   the raw transcript. Fully editable before signing.
6. **Sign**: locks the note. Editing a signed note creates a versioned amendment, not a silent
   overwrite (`note.version` increments, `Edit (creates an amendment)`).
7. **Export**: "Copy note" (plain text) or "Download PDF" — both available pre- or post-sign.
8. **Feedback**: after signing, a 5-star + optional comment prompt on the AI draft's quality — this
   is what feeds the admin Metrics dashboard's satisfaction number. One-time only per note.

## 5. Admin operations

- **Users**: roster, invite new clinicians, deactivate/reactivate (never hard-delete — see
  `../memory/STATUS.md`'s account-offboarding note for why).
- **Patients / Patient detail**: roster + per-patient visit history; patient-initiated
  deletion/amendment requests are logged here (approve/deny + resolution note, never auto-deletes —
  required by the PA retention floor, see `RETENTION-POLICY.md`).
- **Metrics**: review time, edit count, and satisfaction rating aggregated across the clinic — the
  main lever for judging whether the AI drafts are actually saving clinician time during the pilot.

## 6. Known limitations going into the pilot

- Web-only — no native app, no offline recording, no background audio capture.
- `Login.tsx` and `Recording.tsx` have zero automated test coverage (Cognito SDK / MediaRecorder
  depth aren't meaningfully testable under jsdom) — these are the two components most worth a manual
  smoke test before real patient use, not just trusting the green CI checkmark.
- If `MOCK_SOAP_NOTE` is ever set back to `true` (e.g. for a test run), every draft note is labeled
  `[MOCK NOTE]` — do not let a clinician sign a mock note believing it's real AI output; verify the
  mock banner is absent before the first real patient visit of any pilot.
