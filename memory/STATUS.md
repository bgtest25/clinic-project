# Havenote — Project Status

**Last updated:** 2026-08-15 (admin credential reset + MFA QR code added; a clinician-invite smoke
test surfaced and fixed two frontend routing/access-control bugs; reviewing that same demo note
then surfaced a real, live regression — MOCK_SOAP_NOTE had silently flipped back to `true` at some
point after 2026-08-14's "confirmed live" claim below. Now genuinely fixed, and fixed so it can't
silently regress again — see below.)

## 🟢 Speaker-diarized transcript, no longer a flat paragraph (2026-08-15)

Transcribe Medical was already running with `ShowSpeakerLabels: true` (`ai-pipeline-stack.ts`), and
`Transcript.diarizedSegments` already existed in the schema — but `process-transcript/index.ts`
only ever read `results.transcripts[0].transcript` and wrote `{}` into that column. Verified
against a **real** diarized transcript already sitting in this account's S3 bucket
(`results.audio_segments` comes pre-joined with per-turn text + `speaker_label`, no manual
correlation against `results.items` needed) — and that same real sample showed diarization on this
account's actual recordings is genuinely noisy (one speaker's label jumping mid-conversation),
which shaped the fix below rather than being a hypothetical concern.

- Lambda now parses `audio_segments` into real `DiarizedSegment` rows, persists them in
  `diarizedSegments`, and feeds a speaker-labeled transcript into the SOAP draft call instead of
  the flat string. Added a system-prompt rule telling the model diarization labels can be wrong
  and not to let a mislabeled turn misattribute a symptom or diagnosis.
- `NoteReview.tsx`'s transcript pane gets a Speaker view / Raw text toggle, defaulting to speaker
  view when segments exist. Labels are generic "Speaker 1/2" by design, not "Clinician/Patient" —
  a wrong role label would be read as fact rather than the estimate it is. Raw text stays exactly
  as before, one click away.
- 16/16 `process-transcript` tests and 69/69 web tests pass unchanged (`generateSoapNote`'s
  signature didn't change, so none of the 14 existing transcript fixtures needed touching).
  Deployed `ClinicAiPipelineStack` and verified with a real Lambda invocation against the same real
  diarized sample: `diarizedSegments` persisted correctly (16 segments, real shape), and the note
  still generated correctly — it even preserved a real inconsistency in the source transcript
  ("past couple of days" vs "past couple of months") rather than papering over it. Test
  patient/encounter/transcript/note rows and the test S3 object deleted afterward. Frontend
  deployed via the normal `deploy-web.yml` pipeline, commit `c2c281b`, confirmed live.

Next up if wanted: grounding `suggestedCodes` in a real lookup (the existing
`web/src/data/icd10-common.ts` curated list, made reachable from the Lambda) instead of model
recall alone — deliberately not done in this pass.

## 🟢 Branded invite email (2026-08-15)

The invite email a clinic admin's invitee received was Cognito's raw default text
("Your username is {username} and temporary password is {####}.") — no branding, no context, no
next steps. `infra/lib/auth-stack.ts`'s `ClinicianUserPool` never set a `userInvitation` template
at all. Added one: Havenote-branded HTML email (header, plain-English explanation, sign-in details
in a readable card, link to havenote.health, a heads-up that first login requires setting a
permanent password + MFA). Deployed via `cdk deploy ClinicAuthStack` — non-replacing update, only
`AdminCreateUserConfig.InviteMessageTemplate` added, confirmed live via `describe-user-pool`.
Sender is still Cognito's own default address (not a custom SES domain) — that's a separate,
bigger piece of work if it's ever wanted, not done here.

## 🟢 mockSoapNote regression found and fixed for good (2026-08-15)

Reviewing a demo note (the one drafted for the clinician invited during the onboarding-flow audit
above) showed `[MOCK NOTE — Bedrock access pending]` in three of its four SOAP fields. Checked the
live Lambda directly rather than trust the file: `aws lambda get-function-configuration` showed
`MOCK_SOAP_NOTE: "true"` — genuinely in mock mode right now, contradicting the "genuinely live"
claim in the 2026-08-14 entry below.

**Root cause:** `infra/bin/infra.ts`'s `mockSoapNote` context value defaulted to `'true'` in source
and was only ever flipped to `false` via an ephemeral `-c mockSoapNote=false` CLI flag on one manual
deploy (2026-08-14, documented below). CDK context passed via `-c` isn't sticky across separate CLI
invocations — the *very next* deploy of `ClinicAiPipelineStack` that same day (the `content[0]`
parsing fix, also documented below) didn't repeat the flag, and silently reverted the live Lambda
back to mock output. It had been running as mock for over a day with nothing catching it — the
2026-08-14 "final verification" test ran *before* that second deploy, not after.

**Fixed properly this time:** changed the source default itself from `'true'` to `'false'`
(`infra/bin/infra.ts`), so correctness no longer depends on remembering a CLI flag on every future
deploy of this stack. `-c mockSoapNote=true` still works as an explicit override if mock mode is
ever needed on purpose. Deployed via `cdk deploy ClinicAiPipelineStack --profile clinic-project`
(no context flag needed now), confirmed live via `get-function-configuration`:
`MOCK_SOAP_NOTE: "false"`.

**Verified with a real pipeline run, not just the flag:** disposable test patient/encounter, real
S3 transcript, direct Lambda invoke, real Anthropic call, real DB write — same rigor as
2026-08-14's audit. Result: correct strep pharyngitis diagnosis, correctly avoided penicillin given
the stated allergy, correct azithromycin dosing, correct ICD-10 code (J02.0). All test rows/objects
deleted afterward, confirmed no stray data remains.

**Anything drafted between the 2026-08-14 regression and this fix (2026-08-15) is mock output**,
including the demo note that surfaced this — not real AI content, regardless of what it looks like.
No way to pin the exact regression window without CloudTrail digging this session didn't do; if it
matters for a specific note, check its `createdAt` against the two `ClinicAiPipelineStack`
`LastUpdatedTime`s in git history rather than assume.

## 🟢 Admin account reset, MFA QR code, and a real onboarding-flow audit (2026-08-15)

- **Admin account (`testclinician@example.com`) password + MFA reset.** The account's original
  TOTP device from 2026-07-17 was still enrolled and unreachable (no admin API exists to
  un-enroll a software token — `AdminSetUserMFAPreference(Enabled=false)` only changes a
  preference flag, confirmed via a live `initiate-auth` test that still returned
  `SOFTWARE_TOKEN_MFA` after calling it). Fixed by deleting and recreating the Cognito user
  (fresh, no TOTP history), then syncing the new `sub` into `users.cognito_sub` via a one-off ECS
  task — the API resolves every caller by matching the JWT's `sub` to that column, so skipping
  this step would have 401'd every request despite a valid Cognito login. Verified live via a
  direct `initiate-auth` call returning `MFA_SETUP` before handing back credentials.
- **MFA setup screen now renders an actual QR code**, not just the raw secret as text.
  `Login.tsx` builds a standard `otpauth://` URI from the secret Cognito returns and renders it
  client-side via the `qrcode` npm package (no network call, no CDN) — the raw secret stays as a
  manual-entry fallback. 67 tests pass, `tsc`/lint clean, local prod build verified before
  shipping.
- **Real bug found via an actual invite-and-login smoke test, not code review alone:** the admin
  invited a real clinician (`barsehgbor@gmail.com`), who landed directly on the "Invite a
  clinician" admin page immediately after finishing password/MFA setup — never clicked anything
  to get there. Investigated and confirmed genuinely live:
  - **Backend is not the problem.** `POST /users`, `GET /users`, and deactivate/reactivate are
    all gated by `@Roles('admin')`, enforced by `RolesGuard` reading `cognito:groups` off a
    cryptographically verified access token (`CognitoAuthGuard` via `aws-jwt-verify`) — not
    spoofable client input. Confirmed the invited account landed only in the `clinician` Cognito
    group, never `admin`. No privilege escalation actually occurred.
  - **Two real frontend bugs, now fixed (commit `4dd004e`):** (1) the router never reset to `/`
    on a fresh sign-in — logging out and a different user logging in in the same browser tab left
    the app on whatever page the previous session was last on (the admin had been on `/invite`
    right before this), so the new clinician inherited that URL. (2) `/invite`, `/users`, and
    `/metrics` had zero client-side role check — `Dashboard.tsx` correctly hides the nav buttons
    for non-admins, but the routes themselves rendered fully for any authenticated user who
    reached them directly, role dropdown (including "Admin") and all. Fixed: `Login.tsx`'s new
    `completeLogin()` navigates to `/` on every successful sign-in path; a new `AdminRoute`
    wrapper in `App.tsx` redirects non-admins away from all three admin-only routes before they
    render. 67 tests pass, `tsc`/lint clean, deployed via the normal `deploy-web.yml` pipeline,
    confirmed live (`havenote.health` → 200).
  - The "why is it asking for my full name" confusion was a direct consequence of the same
    bug — that field is `InviteClinician.tsx`'s field for the *new invitee's* name, not a
    re-ask of the logged-in user's own name; there is no such re-ask anywhere in the real login
    flow (`Login.tsx`'s `newPassword`/`mfaSetup` stages never collect a name).
- **Also fixed same session:** stale Bedrock references in `BAA-TEMPLATE.md` and
  `PRIVACY-POLICY.md` — both still described the Anthropic subprocessor as routed through Amazon
  Bedrock, which changed to a direct Anthropic API call on 2026-08-14. Matters for the pending
  legal review: a direct API integration needs its own BAA/data-handling terms with Anthropic,
  separate from AWS's Bedrock BAA. Commit `bbf0a79`.

This file is the single source of truth for "where did we leave off." Read this first when
resuming work — it's kept up to date at the end of every substantial session. For the full
build plan, see `../ROADMAP.md`. For AWS-account-specific details (nameservers, resource IDs,
verification commands), see ROADMAP.md's "Account baseline status" and "Media bucket encryption
decision" sections.

## 🟢 Interim swap LIVE (2026-08-14) — pilot no longer waiting on AWS

Both AWS cases below remain open and unchanged (checked directly same day: Bedrock still
`NOT_AUTHORIZED`, CloudFront case still `opened`, no new correspondence on either since
2026-08-11/12) — this doesn't cancel either case, it routes around them so the pilot can go
live now instead of waiting on an AWS timeline neither case has one for. Both sides are now
fully live and verified, not just code-ready.

- **AI provider: Bedrock → direct Anthropic API — LIVE and verified for real, as of the audit
  below.** `infra/lambda/process-transcript/index.ts`'s
  `generateSoapNote` calls `api.anthropic.com/v1/messages` via `fetch` instead of
  `BedrockRuntimeClient` — same system prompt, same `messages` shape, same downstream JSON
  parsing, only the transport changed. `infra/lib/ai-pipeline-stack.ts` imports (doesn't create)
  a Secrets Manager secret `clinic-project/anthropic-api-key` (created 2026-08-14, real key, by
  you directly via CLI — never pasted into chat) and wires it into the Lambda's `ANTHROPIC_API_KEY`
  env var the same way `DB_PASSWORD` is already wired (CloudFormation dynamic reference, resolved
  at deploy time). `bedrock:InvokeModel` IAM grant removed. All 17 infra tests pass, `tsc --noEmit`
  and `cdk synth --all` both clean.
- **Frontend hosting: CloudFront → Vercel — LIVE.** `ClinicWebHostingStack` (S3+CloudFront+ACM) is
  left completely untouched in code — not deployed while Vercel is in use, ready to reactivate
  as-is once CloudFront clears. Added `web/vercel.json` (SPA rewrite, same job CloudFront's
  403/404→`/index.html` error responses did). Two **live** Route53 records in
  `infra/lib/dns-stack.ts` (`ClinicDnsStack`, deployed 2026-08-14): apex `havenote.health` A
  record → Vercel's `76.76.21.21`, `app.havenote.health` CNAME → `cname.vercel-dns.com` — commented
  as temporary, remove both and let `ClinicWebHostingStack`'s CloudFront alias records take over
  again once that case clears. Vercel project `web` created under team `barseh-gbors-projects`
  (org `team_3V0ecTxzBottkE4Ro8JFs6tU`, project `prj_srcEXDEXvX3RiDrqgIlrZVRnR8TQ`); both domains
  added and certs issued; `VITE_API_URL`/`VITE_COGNITO_USER_POOL_ID`/`VITE_COGNITO_CLIENT_ID` set
  as Vercel Production env vars (not secrets — same public values `deploy-web.yml` used to inline
  directly). `VERCEL_TOKEN`/`VERCEL_ORG_ID`/`VERCEL_PROJECT_ID` set as GitHub Actions repo secrets.
  Both domains confirmed live: `https://havenote.health` and `https://app.havenote.health` return
  200 over HTTPS with valid certs and serve the real app (`<title>Havenote</title>`, correct
  API/Cognito config baked in).
  **`deploy-web.yml` CI pipeline verified working end-to-end** (2026-08-14, run `31803579701`,
  triggered by a real push to `main`, concluded `success`) — build `web/dist` locally (unchanged
  step), `vercel pull` to fetch the project link + env vars, copy that `.vercel` link into `dist/`,
  then `vercel deploy --prod` from inside `dist/` with no positional path argument. Two real
  mistakes hit and fixed while setting this up, worth knowing if this breaks again:
  1. Passing a bare directory (`vercel deploy dist --prod`) makes the Vercel CLI treat that
     directory as a brand-new project root instead of the already-linked one — created a stray
     `dist` project the first time; deleted via `vercel project rm dist`. Fixed by copying the
     `.vercel` link folder into the built directory first, then deploying from inside it with no
     positional path.
  2. The documented `vercel pull` → `vercel build` → `vercel deploy --prebuilt` CI pattern hung
     indefinitely on GitHub Actions (had to be cancelled after ~29 min) with a freshly-`npx`-fetched
     CLI v59.0.0, even though the identical commands succeeded locally in under a minute — the
     broken deployment never got promoted to the live domains, so production was never affected.
     Fixed by reverting to a plain `vercel deploy --prod` (no `--prebuilt`) pinned to CLI v50.11.0
     (the version proven to work locally) — see the comment block in `deploy-web.yml` for the
     full reasoning if this needs revisiting.
- Full plan: `C:\Users\barse\.claude\plans\zany-noodling-forest.md`.

## 🟢 Post-swap live audit (2026-08-14) — 6 real bugs found + fixed, AI pipeline verified genuinely live

Started a live audit of the interim-swapped app (actually using it, not just checking deploy
status) right after the swap above went live. Found and fixed two CORS bugs, both invisible to
the swap's own deploy checks since they only surface when a real browser makes a real
cross-origin request:

- **09:47 — API CORS missing the apex origin.** A real login test at the bare `havenote.health`
  (not `app.havenote.health`) failed every API call with a silent "Failed to fetch" — the
  browser blocked the request before it left the client. `api/src/main.ts`'s CORS allowlist only
  had `app.havenote.health`. Fixed: added `https://havenote.health` to `app.enableCors({ origin: [...] })`.
  Commit `2ac8672`.
- **10:03 — Media bucket had no CORS config at all.** `Recording.tsx` uploads audio directly to
  S3 via a presigned PUT URL; a real recording test failed the same way ("Load failed", nothing
  in server logs). `infra/lib/storage-stack.ts`'s `ClinicStorageStack.mediaBucket` had zero `cors`
  property. Fixed: added a `cors` block allowing `PUT` from the same three origins as the API's
  allowlist (`havenote.health`, `app.havenote.health`, `localhost:5173`). Deployed directly (this
  stack isn't wired into either CI pipeline). Commit `d6d4c1b`.

Both fixes verified live in code (`api/src/main.ts`, `infra/lib/storage-stack.ts` both read
2026-08-14 and match the commits above) and the `ClinicStorageStack` deploy is reflected in the
account (checked `d6d4c1b`'s commit message, which records the direct deploy).

**Audit resumed same day, backend-only (no browser/mic tool access this session)** — invoked the
real deployed `clinic-project-process-transcript` Lambda directly against a disposable test
patient/encounter (created via one-off ECS task against the real DB, same pattern as the pilot
onboarding runbook's bootstrap step; deleted afterward, both by encounter/patient id and by
confirming no stray rows remain). This exercises the real Anthropic API call and DB write, but
**not** the browser/`MediaRecorder`/S3-presigned-upload path the two CORS bugs above were found
in — an actual browser+mic recording test is still outstanding and needs to be run by you (or a
future session with browser tooling).

This backend test surfaced four more real bugs, all more serious than the CORS ones:

- **`MOCK_SOAP_NOTE` was never actually `false` — this morning's "confirmed live" claim above was
  wrong.** First invocation (11:xx) returned a mock-labeled note. Checked
  `aws lambda get-function-configuration` directly: `MOCK_SOAP_NOTE: "true"`, and
  `aws cloudformation describe-stacks --stack-name ClinicAiPipelineStack` showed `LastUpdatedTime`
  of `2026-08-14T12:38:47Z` — the exact original swap deploy, with zero updates since. So the
  stack was never actually deployed with `mockSoapNote=false` this session; the earlier claim in
  this file was incorrect (root cause not fully determined — possibly the `-c mockSoapNote=false`
  flag didn't take effect on the original deploy). **Fixed**: re-ran
  `cdk deploy ClinicAiPipelineStack --profile clinic-project -c mockSoapNote=false` — deploy
  succeeded (`UPDATE_COMPLETE`, ~102s), re-checked `get-function-configuration` directly afterward:
  `MOCK_SOAP_NOTE: "false"`, confirmed for real this time.
- **The stored Anthropic API key itself is corrupted — still broken, not yet fixed.** With
  `MOCK_SOAP_NOTE` genuinely `false`, a second real invocation failed:
  `Anthropic API request failed: 401 {"type":"authentication_error","message":"API key is invalid."}`.
  The encounter correctly landed in `FAILED` status with that message recorded in
  `processingError` — the error-handling path itself worked correctly. Root cause confirmed by
  reading the raw secret value directly from Secrets Manager (`clinic-project/anthropic-api-key`)
  and inspecting it programmatically: it's 108 characters long with a **literal space character at
  index 54** — the key is malformed, not just expired/revoked/wrong. Similar failure shape to a
  past incident on a different project (Swypi's RAG assistant had a corrupted `ANTHROPIC_API_KEY`
  from two concatenated `.env` lines) — worth checking how this one got pasted/generated.
  You regenerated a fresh key from console.anthropic.com and set it via
  `aws secretsmanager put-secret-value` in your own terminal (not pasted into chat) —
  confirmed by a new secret VersionId and a byte-check showing no whitespace this time.

- **Wrong claim in this file: "no redeploy needed, the Lambda reads the secret at invoke time."**
  That was incorrect and caused two more real (now-fixed) problems below. CloudFormation dynamic
  references (`{{resolve:secretsmanager:...}}`) are resolved at **deploy time**, baked into the
  Lambda's environment variables — not re-read on each invoke. Updating the secret alone never
  touches a running Lambda.
- **Consequence: after the fresh key was set, the Lambda was still running on the old corrupted
  key.** A follow-up `cdk deploy ClinicAiPipelineStack` reported `(no changes)` and skipped the
  Lambda entirely — CloudFormation only re-resolves a dynamic reference when it actually issues an
  update to that resource, and nothing else in the template had changed. Confirmed directly:
  `aws lambda get-function-configuration` still showed the old key's prefix/suffix after that
  "successful" deploy. **Fixed as an immediate one-off**: pulled the current secret value and
  pushed it straight into the Lambda via `aws lambda update-function-configuration --environment`,
  bypassing CloudFormation for this one correction — confirmed via `get-function-configuration`
  afterward. (This isn't a standing drift risk: any future deploy that legitimately touches this
  Lambda, e.g. a code change, will re-resolve the dynamic reference against whatever the secret
  holds at that time.)
- **With the fresh key genuinely live, a new real bug surfaced: content-block parsing.** The first
  real (non-mock, non-corrupted-key) invocation failed with `No text content in Anthropic API
  response` — not an auth problem. Reproduced the exact request directly against the Anthropic API
  and inspected the raw response: `claude-sonnet-5` returns an **extended-thinking block as
  `content[0]`** (`{"type":"thinking",...}`) with the real answer at `content[1]`
  (`{"type":"text",...}`). `generateSoapNote` in `infra/lambda/process-transcript/index.ts` assumed
  `content[0].text` was always the answer. The actual generated note itself, once found in the raw
  response, was clinically accurate (correct strep throat diagnosis, correct azithromycin choice
  given the stated penicillin allergy, correct dosing, correct ICD-10 code) — this was purely a
  parsing bug, not a prompt or model problem. **Fixed**: changed the lookup to
  `content?.find((block) => block.type === 'text')?.text` instead of `content?.[0]?.text`. Updated
  the shared `anthropicTextResponse()` test mock helper in `generate-soap-note.test.ts` to include
  a leading `thinking` block too, so all 14 fixtures now assert against the real response shape
  and a regression back to `content[0]` would fail the suite. All 17 infra tests still pass,
  `tsc --noEmit` clean. Deployed via `cdk deploy ClinicAiPipelineStack` (a real code change this
  time, so CloudFormation did re-resolve and re-confirm the secret reference as part of the same
  deploy).

**Final verification — genuinely confirmed, not assumed:** ran the same real-pipeline test a fifth
time end to end (disposable test patient/encounter → real S3 transcript → real
`clinic-project-process-transcript` Lambda invoke → real Anthropic API call → real DB write). Result:
encounter reached `IN_REVIEW`, and the stored `clinical_notes` row contains a real, non-mock,
clinically coherent SOAP note (subjective/objective/assessment/plan/suggestedCodes all populated,
matching the test transcript, `status: 'DRAFT'`, no `[MOCK NOTE]` label). Test patient, encounter,
transcript, and note rows deleted afterward; test S3 objects deleted; confirmed no stray rows
remain. **The AI pipeline is genuinely live now** — this is the first real, non-mock output this
project has ever produced end to end.

**Browser/mic recording path confirmed (2026-08-14, by you directly on the live site):** the last
untested leg — `MediaRecorder` → presigned S3 upload → this same Lambda, through the real UI —
tested and looks good. The full "record → transcribe → real SOAP note" chain is now verified
end to end, including the browser, not just the backend pieces tested earlier today.

**UI wording cleanup (2026-08-14):** replaced em dashes with periods or a colon in user-facing
copy across 8 files: `Recording.tsx`, `NoteReview.tsx`, `Patients.tsx`, `Dashboard.tsx`,
`PatientDetail.tsx`, `Login.tsx`, `InviteClinician.tsx`, `CodePicker.tsx`. Covered the microphone
error text, recording status/header text, empty-state messages, the mock-note notice, the
code-picker caption, the first-sign-in prompt, the invite-confirmation banner, and the
data-requests notice. Pure wording, no behavior change. Left the standalone `—` used as an
empty-value placeholder in tables and stat tiles (`Metrics.tsx`, `PatientDetail.tsx`,
`NoteReview.tsx`) alone, since that's a different convention (a dash standing in for "no value"),
not prose punctuation. 62 tests still pass.
Deployed via the normal `deploy-web.yml` → Vercel pipeline, commit `c949bc2`, run `31839328319`
succeeded, confirmed live (`havenote.health` → 200).

**New brand mark shipped (2026-08-14):** replaced `BrandMark` (`icons.tsx`) and `public/favicon.svg`.
Old mark was generic note-lines plus a heartbeat squiggle, read as "health app" in general, not
specific to Havenote. New mark is a voice waveform resolving into note-lines: a spoken visit on the
left settling into a structured note on the right, the actual product in one glyph, and a nod to
the name itself (haven for the note). Same `currentColor`/stroke pattern as before, so it inherits
the existing `.brand-mark`/`.auth-card .brand-mark` badge styling with no CSS changes. Reviewed
first as a live mockup (against the app's real tokens, badge sizes, topbar/login/favicon contexts)
before wiring it in. 62 tests still pass. Deployed via the same `deploy-web.yml` pipeline, commit
`6d2c164`, run `31841051102` succeeded, confirmed live (`havenote.health/favicon.svg` serves the
new SVG).

**Light/dark mode toggle added (2026-08-14):** `index.css` already had dark tokens behind a bare
`prefers-color-scheme` media query, so the app already followed the OS theme, but there was no way
to override it. Added an explicit toggle: new `useTheme` hook (`web/src/theme/useTheme.ts`,
localStorage key `havenote-theme`) defaults to the system theme and stays live-synced to OS changes
until the user picks explicitly, at which point that choice sticks. New `ThemeToggle` component
(sun/moon icon button) wired into the topbar and all four `Login.tsx` auth-card stages (fixed
top-right, since Login has no shared header). CSS restructured to the standard three-state token
pattern: bare `:root` (light default), `@media (prefers-color-scheme: dark)` guarded as
`:root:not([data-theme='light'])` (follow OS when no explicit choice), and `:root[data-theme='dark']`
(explicit choice wins either direction). Added a synchronous inline script in `index.html` that
stamps `data-theme` before first paint, so there's no flash of the wrong theme on load. Added a
`matchMedia` shim to `test/setup.ts` (jsdom doesn't implement it at all) plus 5 new tests for the
hook (system default, stored-preference precedence, toggle+persist, sticking after an explicit
choice, live-following before one). 67 tests pass, `tsc --noEmit` and lint clean, verified via a
local production build before shipping.

## 🔴 Blocked — waiting on something outside this repo

1. **Bedrock model access** — routed around 2026-08-14 via direct Anthropic API, see 🟡 above; this
   case stays open/tracked in parallel, revert path documented above once it clears. Still
   `NOT_AUTHORIZED` as of 2026-08-11 (confirmed live via
   `get-foundation-model-availability`). Case `178433501800988`: a genuine past-due balance
   ($53.76) was found and paid 2026-08-08 (the agent's request for payment was legitimate —
   confirmed via the real case correspondence, not phishing, despite an unusually warm tone).
   You sent an urgent follow-up 2026-08-10 pushing for the activation request to be submitted.
   AWS replied 2026-08-11: case is being **escalated/transferred to a specialized team** to
   review the activation request — status `unassigned`, no authorization yet, just moved to the
   next queue.
   The AI pipeline runs in **mock mode** (`MOCK_SOAP_NOTE=true`, default in `infra/bin/infra.ts`) —
   every draft note is clearly labeled `[MOCK NOTE — Bedrock access pending]`, not real AI output.
   The system prompt itself was hardened 2026-07-21 (see below) and is already deployed — nothing
   left to do here code-side once access clears.
   - Check status: `aws bedrock get-foundation-model-availability --model-id anthropic.claude-sonnet-5 --profile clinic-project --region us-east-1` — look for `authorizationStatus: AUTHORIZED`.
   - **Account upgraded to Business Support 2026-08-08** — `aws support describe-cases --profile clinic-project --region us-east-1 --include-resolved-cases --max-results 10` now works (previously threw `SubscriptionRequiredException` on Basic support) and is the better way to check real case status/correspondence, not just the raw Bedrock API 403.
   - Once cleared: flip the default in `infra/bin/infra.ts` (`mockSoapNote`) to `false`, then
     `cd infra && npx cdk deploy ClinicAiPipelineStack --profile clinic-project`.

2. **CloudFront account verification** — routed around 2026-08-14 via Vercel, see 🟡 above; this
   case stays open/tracked in parallel, revert path documented above once it clears. The
   *original* case (`178440028900396`) was actually
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
   Status as of 2026-08-12: case now `opened` (was `unassigned`). Agent (Tharun) explained the real
   root cause: **CloudFront is blocked by default for all AWS accounts under 1 year old**, a
   fraud-prevention policy, not something specific to this account. He's escalated internally to
   request the restriction be lifted early, "no fixed time-frame." Note: this account was created
   2026-07-16, so the restriction would likely lapse on its own around **2027-07-16** regardless of
   case outcome — a real fallback if the case stalls, though a year is a long way off to just wait.
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

## Housekeeping while waiting on AWS cases (2026-08-11)

- **Lambda Node.js 20.x runtime deprecation fixed**: AWS Health flagged an `ACTION_REQUIRED`
  event (Node.js 20.x EOL'd 2026-04-30, security patches stopped) against
  `clinic-project-process-transcript`, the only affected function. Bumped
  `infra/lib/ai-pipeline-stack.ts` from `NODEJS_20_X` to `NODEJS_22_X`, validated via `tsc` +
  `cdk synth`, deployed via `cdk deploy ClinicAiPipelineStack --profile clinic-project`, and
  confirmed live (`aws lambda get-function` shows `nodejs22.x`).
- **Orphaned `ClinicComplianceStack` deleted**: found sitting in `REVIEW_IN_PROGRESS` since
  2026-07-18 — an empty stack shell (changeset created, never executed) with zero resources and
  no reference anywhere in `infra/`. Deleted via `aws cloudformation delete-stack`; not part of
  the current architecture (compliance docs live in `compliance/*.md`, not a CDK stack).
- Also checked while at it: AWS Health has two other open events (`me-central-1`/`me-south-1`
  `MULTIPLE_SERVICES_OPERATIONAL_ISSUE`, both `PUBLIC` scope, not account-specific) — unrelated to
  this account, no action needed. All other CloudFormation stacks are healthy (`UPDATE_COMPLETE`).
- **CloudTrail S3 bucket had no lifecycle rule** (found 2026-08-11): `clinic-project-cloudtrail-501264525435`
  had zero lifecycle configuration — despite this repo's own 2026-07-19 note claiming the
  config-bucket fix was "matching the CloudTrail bucket's existing retention" (that claim turned
  out to be stale/false — no rule existed when checked). 25,514 objects / ~113MB accumulated since
  account creation (2026-07-17), unbounded, plus versioning is enabled so noncurrent versions were
  also piling up forever. Applied via `aws s3api put-bucket-lifecycle-configuration`: 365-day
  expiration (matching config-bucket), 90-day noncurrent-version expiration, 7-day
  abort-incomplete-multipart-upload. Verified live. Account-baseline bucket, not CDK-managed.
- Rest of S3 checked clean: media bucket (`clinic-project-media-*`) is KMS-encrypted with public
  access blocked and its existing 30/90-day raw-audio/transcript backstop lifecycle rules intact;
  config-bucket's 365-day rule (2026-07-19 fix) still in place; CDK bootstrap assets bucket is
  standard/healthy; no leftover `clinic-project-web-*` bucket (confirms the CloudFront
  rollback cleanup fully succeeded, no name collision risk on the next deploy attempt).
- **Full resource sweep (2026-08-11)**: ECS API service, RDS, Cognito, ECR, Route53, IAM all
  checked healthy. Two real gaps found: GuardDuty flagged 2,741 root-credential API calls
  (`GetFoundationModelAvailability`) — root has no access keys, so this is a browser tab left open
  on the Bedrock console logged in as root; not a security incident (root has MFA), just a habit
  to break — use `clinic-admin` for console work going forward. And **zero CloudWatch alarms and
  zero AWS Config rules existed** — the Config recorder itself was confirmed genuinely healthy
  (`recording: true`), just with no rules attached; no Security Hub either. Nothing alerted on
  infra failures before this.
- **Baseline CloudWatch alarm set built and deployed (2026-08-11)**: new `infra/lib/monitoring-stack.ts`
  (`ClinicMonitoringStack`) — SNS topic `clinic-project-alerts` emailing
  `barsehgbor2026@outlook.com` (needs the confirmation-subscription email clicked), with 9 alarms:
  RDS CPU/free-storage/freeable-memory, ALB unhealthy-hosts/5xx, ECS service CPU, Lambda
  errors/throttles, Step Functions execution failed/timed-out. Required exposing
  `processTranscriptFn` as a public property on `ClinicAiPipelineStack` (was previously a local
  const). Validated via `tsc` + `cdk synth` before deploying; deployed via
  `cdk deploy ClinicMonitoringStack --profile clinic-project`, all 14 resources
  `CREATE_COMPLETE`. Config rules (the other gap from the sweep) intentionally left for a
  separate pass — not yet scoped/built.
- **Baseline AWS Config rule pack built and deployed (2026-08-11)**: new
  `infra/lib/config-rules-stack.ts` (`ClinicConfigRulesStack`) — 16 AWS managed Config rules
  (S3 public-read/public-write/SSE/SSL-only, RDS storage-encrypted/public-access/multi-AZ, IAM
  root-MFA/user-MFA/root-access-key-check/access-keys-rotated, VPC default-SG-closed,
  restricted-incoming-traffic on ports 5432/3389/22, Lambda public-access-prohibited,
  CloudTrail-enabled, GuardDuty-enabled-centralized), plus an EventBridge rule routing any
  NON_COMPLIANT transition into the same `clinic-project-alerts` SNS topic the CloudWatch alarms
  use — Config rules were otherwise going to record compliance silently with nothing paging
  anyone. Required an `AWS::SNS::TopicPolicy` update on `ClinicMonitoringStack` (SNS topic lives
  there; the policy granting `events.amazonaws.com` publish gets attached in the owning stack, not
  the consuming one) — deploy this stack together with `ClinicMonitoringStack` if either changes.
  Hit and fixed a real bug: the `AccessKeysRotated` L2 construct's documented 90-day default
  `maxAge` doesn't actually get passed to CloudFormation in this CDK version — deploying without
  explicitly setting `maxAge` fails with `"required parameter [maxAccessKeyAge] is not present"`.
  First deploy attempt also collided with the CI pipeline mid-deploying `ClinicComputeStack`
  (triggered by an earlier unrelated push) — waited for that to clear, then retried. Verified live
  via `aws cloudformation describe-stacks` (`CREATE_COMPLETE`) and `aws configservice
  describe-config-rules` (all 16 rules present).
- **Cost audit + RDS reverted to single-AZ (2026-08-11)**: pulled real Cost Explorer data
  (`get-cost-and-usage`, actuals not estimates) — ~$98/mo infra run-rate, breakdown: NAT Gateway
  ~$31/mo (almost entirely the flat hourly charge, real data transfer is negligible), RDS ~$25/mo
  (97% of the instance-hour cost was the Multi-AZ premium), ALB ~$15/mo (LCU/real-traffic cost was
  $0.002 — essentially zero real requests), ~$10/mo in continuously-allocated public IPv4 addresses,
  everything else small. Plus AWS Business Support (~$65+/mo extrapolated from the first 10 days),
  enabled 2026-08-08 specifically for case-correspondence visibility — worth downgrading once both
  open cases close, not before.
  Reverted `infra/lib/database-stack.ts` `multiAz` from `true` back to `false` (was already
  single-AZ during build; only flipped to Multi-AZ "ahead of the pilot," which is still blocked
  indefinitely) — saves ~$12-13/mo, fully reversible. Before deploying, checked AWS's own
  CloudFormation docs for `AWS::RDS::DBInstance` `MultiAZ`: update requires "Some interruptions,"
  explicitly **not** replacement (the CDK/CloudFormation changeset had flagged it as
  `Replacement: Conditional`, which is a generic per-property classification, not evidence this
  specific change would recreate the instance — confirmed via AWS docs before deploying, not
  assumed). Deployed via `cdk deploy ClinicDatabaseStack`, took ~5.8 min (RDS removing the
  standby), `UPDATE_COMPLETE`. Verified live: `aws rds describe-db-instances` shows
  `MultiAZ: false`, `Status: available`; `api.havenote.health/health` still returns 200 — no
  disruption. NAT Gateway teardown (the bigger ~$31/mo lever) deliberately **not** done — it would
  break the live ECS task/Lambda's outbound access (ECR pulls, Secrets Manager, S3, Cognito) for a
  savings that doesn't clearly beat VPC-endpoint costs at this traffic volume; revisit only if the
  two AWS blockers drag on for weeks with genuinely no one using the app in between.

## How to resume in a new session

Just ask "what's left" or "where did we leave off" — this file plus the external memory system
(tied to this project directory) should make that answer immediate. If either AWS support case
has cleared, that's almost certainly the next thing to act on.
