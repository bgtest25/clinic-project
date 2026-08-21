# Havenote — Project Status

**Last updated:** 2026-08-21 (real production outage found and fixed — blank white screen on
every page load, see 🔴 entry below. Previously, 2026-08-19: independent-review outreach drafted —
see 🟡 entry below. Also that day:
supplementary security scanning (13/15 dependency vulnerabilities fixed, AWS Inspector enabled,
scope doc refreshed), HHS/ONC SRA Tool cross-check built, blank-screen incident found and fixed,
Vercel decommissioned, and the Anthropic BAA outreach — sent by you directly 2026-08-17, logged
here 2026-08-19. Previously, 2026-08-16,
session interrupted mid-work by a computer crash — resumed and
finished: the Security Risk Assessment's risk ratings and sign-off, left blank when the crash hit,
are now complete and committed, see below. Before the crash, same day: real security report: a
clinician's phone stayed silently signed in overnight. Found and fixed a genuine 30-day
session-persistence gap in Cognito's token settings, plus two compounding client-side gaps — see
below. Also shipped: speaker-diarized transcripts instead of a flat paragraph, and ICD-10
suggestions grounded in a real tool-use lookup instead of pure model recall — both verified against
real invocations, not just deployed. Before that, 2026-08-15: admin credential reset + MFA QR code added; a clinician-invite smoke test
surfaced and fixed two frontend routing/access-control bugs; reviewing that same demo note then
surfaced a real, live regression — MOCK_SOAP_NOTE had silently flipped back to `true` at some point
after 2026-08-14's "confirmed live" claim. Now genuinely fixed, and fixed so it can't silently
regress again — see below.)

## 🔴 Real production outage: blank white screen, root-caused and fixed (2026-08-21)

Reported live by the user: visiting the site showed nothing at all, same symptom class as the
2026-08-19 blank-screen incident. **This was a genuinely different bug, not a recurrence of that
one** — that one was a CDN caching/pruning problem; this one turned out to be a regression
introduced by the very fix deployed at the end of that same 2026-08-19 session.

Audited methodically rather than guessing: `curl`'d `index.html` and both referenced asset files
directly first — all three came back exactly right (200, correct content-type, real JS/CSS, not
HTML-fallback), ruling out the 2026-08-19 failure mode immediately. Checked API `/health` — also
fine. Since everything at the HTTP layer was correct, the failure had to be a client-side runtime
error, which curl can't see. Installed Playwright into an isolated scratch directory (not the
repo) and drove a real headless Chromium browser against the live site, capturing console
messages, uncaught exceptions, and failed network requests — this is what actually found it:

```
Error: Both UserPoolId and ClientId are required.
    at new e (https://havenote.health/assets/index-C3DYLzXT.js:11:112240)
```

**Root cause**: Cognito config missing from the built JS bundle. `web/src/auth/cognito.ts` reads
`import.meta.env.VITE_COGNITO_USER_POOL_ID`/`VITE_COGNITO_CLIENT_ID`, which Vite bakes in at
*build* time. `.github/workflows/deploy-web.yml`'s `Build web` step (`npm run build
--workspace=web`) never set these — and never had to, before 2026-08-19. Under the old Vercel
pipeline, that build's output was thrown away; the actual serving build happened server-side on
Vercel, using `VITE_*` values stored in Vercel's own Production environment settings (`vercel pull`
fetched them automatically — see the old workflow's inline comment, preserved in git history at
`eaf2520^`). When `deploy-web.yml` was repointed at CloudFront that same day, this GH Actions build
step's output started being deployed to S3 **directly, as-is** — and it had never been given those
env vars. Every CloudFront deploy since (`eaf2520`, then `6deaf2c` the blank-screen-caching fix
itself) baked in `undefined`, crashing Cognito's SDK constructor on every single page load, for
every visitor, starting **2026-08-19 ~14:16 UTC** — roughly two days before this was reported.

**Why it wasn't caught at the time**: 2026-08-19's "verified live" checks for both the cutover and
the caching fix were curl-based — confirming asset files were real, correctly-typed, non-stale
content. None of them actually loaded the app in a browser and let Cognito's constructor run. A
real HTTP 200 with real JavaScript is necessary but not sufficient for "the app works" — this is
the concrete case proving why.

**Fix**: `.github/workflows/deploy-web.yml`'s `Build web` step now sets `VITE_API_URL`,
`VITE_COGNITO_USER_POOL_ID`, `VITE_COGNITO_CLIENT_ID` explicitly as env vars, sourced from
`web/.env.example` (confirmed those are real, still-live production values via
`describe-user-pool`/`describe-user-pool-client`, not assumed stale). Not secrets — same reasoning
already documented in the old Vercel workflow: the Cognito app client has no client secret, and
both IDs end up in the public JS bundle regardless. Commit `97c0bbe`.

**Verified properly this time, end to end, before and after shipping**:
1. Built locally with the same env vars the fixed workflow now sets; grepped the output bundle to
   confirm the real values (not `undefined`) were actually baked in.
2. Served that local build and re-ran the same real-Chromium check against it — root element
   rendered the actual sign-in form, zero console/page errors.
3. Ran lint (clean, pre-existing warnings only) and the full web test suite (77/77 pass) before
   pushing.
4. Pushed, watched the real `deploy-web.yml` CI run (`32484184341`) succeed end-to-end (3m30s).
5. Re-ran the real-Chromium check against production a second time, post-deploy: confirmed
   `index.html` now references the new bundle hash, zero console/page errors, zero failed network
   requests, and the DOM contains the actual rendered sign-in screen (screenshotted for visual
   confirmation). Repeated separately against `app.havenote.health` (the subdomain clinicians
   actually use), not just the apex domain — same result.

Scratch Playwright install and test scripts lived entirely in the session scratchpad, never
touched the repo; the one-off local `web/dist` test build was deleted afterward.

**Closed the same session**: added `scripts/smoke-test.mjs` (headless Playwright/Chromium,
`playwright` now a root devDependency) plus two new steps at the end of `deploy-web.yml` —
`Install Playwright browser` and `Smoke test deployed site` (`npm run smoke-test`). Runs after
every `cdk deploy ClinicWebHostingStack`, hits both `havenote.health` and `app.havenote.health` for
real, and fails the workflow on any uncaught JS exception, any failed same-origin request, or a
`#root` that renders under 50 characters of HTML (a blank-screen proxy) — retries each URL up to 3
times with a 5s backoff first, in case of transient post-deploy propagation delay. Commit `dcb02ca`.

Verified the check itself actually discriminates, not just always-green: ran it locally against
`https://example.com` (no `#root` at all) first and confirmed it correctly failed with exit code 1
and a real diagnostic, before trusting a pass against the genuinely-fixed production site. Then
pushed for real and watched CI run `32485195143` execute both new steps and pass against live
production — confirmed from the actual job log, not just the green checkmark.

## 🟡 Independent-review outreach drafted, not yet sent (2026-08-19)

You raised a real constraint: solo developer, no budget for a security firm. Talked through
options — HIPAA's actual legal requirement is the risk analysis (done), not a mandatory
third-party pentest, so this doesn't have to block launch the way legal review does; it can be a
documented residual risk if it comes to that. You're leaning toward two low/no-cost paths in
parallel rather than accepting the risk outright:

1. **A peer favor** — a message asking a developer friend to spend a few hours reviewing, pointed
   at `SECURITY-REVIEW-SCOPE.md` as the starting map.
2. **A scoped freelance engagement** (Upwork/Toptal, not a firm) — a posting scoped tightly to
   what actually matters for HIPAA's technical safeguards (§164.312), at your request: auth/session
   security, multi-tenant authorization boundaries (flagged as highest priority), API-layer
   vulnerabilities, encryption verification, audit-log integrity. Deliberately stripped of generic
   filler.

Both drafts are finalized, ready to send — you said you'd send them later today. Not sent by this
session; nothing to verify yet. Log here so a future session has the drafts' content without
re-deriving them, and so "independent review: not started" doesn't get read as "no progress made."

## 🟡 Supplementary security scanning ahead of the independent review (2026-08-19)

Explicitly a stopgap, not a substitute for the real independent security review — same framing as
`compliance/SECURITY-REVIEW-SCOPE.md` already uses. Chose to run additional automated scanning
while that review is still being arranged, and refreshed the scope doc itself (it had gone stale:
still described the retired Vercel hosting as live and the CloudFront stack as dormant code —
fixed, and added today's blank-screen bug to the "already found and fixed" list so a reviewer
doesn't waste time rediscovering it).

- **`npm audit` across all three workspaces found 15 real known vulnerabilities**: `hono` (ReDoS in
  CORS middleware), `js-yaml` (quadratic-CPU DoS), `nanoid` (infinite loop on a zero-size
  generator), `postcss` (arbitrary sourcemap file read), `undici` (cross-user info disclosure,
  CRLF injection, cookie-attribute injection — 5 separate CVEs), `valibot`, and `brace-expansion`
  (DoS). **13 fixed cleanly via `npm audit fix`**, no breaking changes, no manual `package.json`
  edits needed (dry-run confirmed first). Re-ran the full suite afterward rather than trust the
  fix blindly: 51/51 api, 77/77 web, 25/25 infra tests pass, `tsc`/`cdk synth` clean. Committed
  (`5f2344b`).
- **2 vulnerabilities remain, deliberately not force-fixed**: `prisma` CLI → `deepmerge-ts`
  stack-exhaustion DoS, and `brace-expansion` nested inside `aws-cdk-lib`'s own dependencies.
  Both would need `npm audit fix --force`, which downgrades `prisma` to 6.12.0 — a real breaking
  change to the ORM/migration tooling touching the live production database, not something to push
  through unprompted. Checked and confirmed both are devDependency/build-tooling only: the running
  API only ever imports `@prisma/client` (a separate, unaffected package) at runtime, never the
  `prisma` CLI — confirmed via `api/package.json`'s dependencies/devDependencies split. Worth
  noting `api/Dockerfile` currently copies the full `node_modules` (including devDependencies) into
  the runtime image, so the vulnerable code does ship in the container even though nothing in the
  running process ever calls it — a minor image-hygiene gap, not a live exploitable path, not fixed
  this session.
- **AWS Inspector v2 was completely disabled account-wide** (EC2/ECR/Lambda/Lambda-code/code-repo
  scanning all off) — checked directly via `aws inspector2 batch-get-account-status`, not assumed.
  Checked real current pricing before enabling (Lambda ~$0.30/function/month, ECR ~$0.09/initial
  scan + $0.01/re-scan) — negligible at this account's scale (one Lambda, one ECR repo). Enabled
  ECR + Lambda + Lambda-code scanning via `aws inspector2 enable`.

## 🟡 HHS/ONC SRA Tool cross-check built (2026-08-19)

The formal HIPAA Security Risk Assessment gate has one piece left: `SECURITY-RISK-ASSESSMENT.md`'s
sign-off explicitly marks the HHS/ONC SRA Tool cross-check as not yet run. Made real progress on it
without overclaiming completion.

Downloaded the actual current tool directly from healthit.gov (not assumed from prior knowledge) —
version 3.6.1, the Excel Workbook format (141KB XLSX; a Windows desktop app version also exists).
Parsed it for real with the `xlsx` npm package rather than guessing its structure: **125 questions
across 7 sections** (SRA Basics, Security Program Documentation, Security Official & Workforce,
Access/Encryption/Audit Technical Safeguards, Physical Safeguards, Business Associates, Contingency
Planning) — the 125 count matches the tool's own documentation, confirming the parse was accurate.

Deliberately did **not** attempt to mechanically fill in the actual government XLSX file — most of
its questions are genuine organizational-practice judgment calls (workforce training-record
retention, sanction-policy specifics, vendor-monitoring cadence), not technical facts with a single
correct answer, and editing a binary spreadsheet's cells directly is hard to audit and risks subtle
placement errors. Built `compliance/SRA-TOOL-CROSS-CHECK.md` instead: every one of the 125 real
questions, mapped to either a confident, cited answer (drawing on
`HIPAA-RISK-ASSESSMENT-EVIDENCE.md`, `SECURITY-RISK-ASSESSMENT.md`, and known project facts like
team size and no pilot clinic signed yet) or explicitly flagged "needs your input" where it's a
genuine judgment call — same "build the evidence, leave judgment to the assessment owner" pattern
already used for the internal risk assessment. Roughly half the questions land in each bucket —
Section 4 (technical safeguards) answers almost entirely with citations, Section 3 (workforce) and
Section 5 (physical) lean heavily toward "needs your input" or "N/A, cloud-only architecture,"
honestly reflecting a one-person team with no signed workforce or physical office holding ePHI.

Also fixed a small real inaccuracy found along the way: `SECURITY-RISK-ASSESSMENT.md` had stated
the Anthropic outreach was sent 2026-08-16 — corrected to 2026-08-17, matching what you actually
told this session (see the entry below).

**Still needs you**: actually open the real SRA Tool (Windows app or Excel workbook) and transcribe
the cross-check's answers section by section, verifying each against its cited source rather than
trusting this document blindly — then flip `SECURITY-RISK-ASSESSMENT.md`'s sign-off checkbox once
done.

## 🟡 Anthropic BAA outreach sent (2026-08-17, logged 2026-08-19)

You sent the BAA/DPA request to Anthropic's commercial team directly (not through this session) on
2026-08-17, from `hello@havenote.health` — the business email set up 2026-08-16 specifically for
this. No reply yet as of this logging (2026-08-19). This was the actual next step on the
"Anthropic BAA/DPA" pre-production gate item; `compliance/ANTHROPIC-DATA-FLOW-SUMMARY.md` was
prepared 2026-08-16 as the supporting material for exactly this outreach. Follow up if there's no
response after a reasonable window — no fixed SLA known for Anthropic's commercial team.

## 🟢 Real live incident: blank/black screen, found and fixed for good (2026-08-19)

Reported live by the user right after the CloudFront cutover below: the site loaded as a completely
blank/black screen. Confirmed genuinely live via direct `curl` against `havenote.health` before
touching anything — `index.html` itself returned 200 with correct content, but its referenced JS
bundle path (an old hash from earlier in the day) returned **200 with `Content-Type: text/html`**
instead of real JavaScript. Root cause: `ClinicWebHostingStack`'s original single `BucketDeployment`
set **no `Cache-Control` metadata on anything**, and defaults to pruning old files on every deploy.
Several deploys happened in quick succession today (the CloudFront cutover, then a CI-pipeline test,
then a manual redeploy), each producing a new content-hashed JS filename and, by default, deleting
the previous one. A browser (or CloudFront's own default edge TTL, up to 24h with no origin
Cache-Control) that had `index.html` cached from an earlier deploy would then request a JS filename
that no longer existed — CloudFront's SPA-fallback error response (`403/404 → 200 /index.html`,
added 2026-08-14 for client-side routing) silently served the fallback HTML instead of a real 404.
The browser tried to parse HTML as a JS module, failed, and React never mounted. No console error a
typical user would think to check, just a blank page.

**Immediate relief**: told the user to hard-refresh, which worked (confirms the diagnosis — a plain
reload wasn't fetching a fresh `index.html`).

**Fixed at the root, not just for this one incident** (`infra/lib/web-hosting-stack.ts`): split the
single `BucketDeployment` into two. Content-hashed assets (`/assets/*`) now get
`Cache-Control: public, max-age=31536000, immutable` and **`prune: false`** — old hashed files are
never deleted on future deploys, so a stale `index.html` anywhere will always find what it's asking
for. `index.html` itself gets its own deployment with `Cache-Control: no-cache, must-revalidate` (so
it's never held stale by a browser or CloudFront again) and an explicit CloudFront invalidation
scoped to just `/index.html`. `indexHtml.node.addDependency(hashedAssets)` guarantees the mutable
file only goes live after the immutable files it might reference already exist. 25/25 infra tests
pass, `tsc`/`cdk synth` clean — checked before deploying.

**Verified live, twice — once manually, once for real through the fixed CI pipeline**: deployed
manually first, confirmed via direct `curl` that a since-superseded JS bundle from an earlier deploy
today was still reachable (200, correct content) post-fix, proving `prune: false` actually prevents
the failure mode. Then committed and pushed, watched the real `deploy-web.yml` CI run
(`32265169680`) succeed end-to-end (3m45s), and did a full simulated page load against production
afterward: fetched the live `index.html`, extracted every asset it references, confirmed each one
returns 200 with the correct content-type and real (non-HTML-fallback) content — JS bundle starts
with real minified JS, not `<!doctype html>`. Also confirmed the API is still reachable from the
frontend's origin with correct CORS. Site loads correctly.

## 🟢 Vercel decommissioned — project and CI secrets deleted (2026-08-19)

Housekeeping right after the CloudFront cutover confirmed the interim Vercel hosting (live
2026-08-14 → 2026-08-19) was no longer referenced by anything. Verified nothing was live-affected
before deleting: `havenote.health`/`app.havenote.health` confirmed still 200 via direct `curl`
immediately before and after each deletion step.

- Deleted the Vercel `web` project (`vercel project rm web`) — the Vercel account
  (`barseh-gbors-projects`) is shared with the unrelated Swypi project (`landing`, `admin` projects),
  confirmed via `vercel project ls` before touching anything so only `web` was ever in scope.
- Removed the now-orphaned `havenote.health` domain reference left on the account after the project
  deletion (`vercel domains rm havenote.health`) — `swypi.app` untouched.
- Deleted the three now-unused GitHub Actions secrets (`VERCEL_TOKEN`, `VERCEL_ORG_ID`,
  `VERCEL_PROJECT_ID`) via `gh secret delete`, confirmed via `gh secret list` returning empty
  afterward. Nothing in the repo references them anymore since `deploy-web.yml` was already
  repointed at `ClinicWebHostingStack`.

## 🟢 CloudFront cutover complete — real root cause found and fixed, frontend off Vercel (2026-08-19)

Checked both open AWS cases directly (`aws support describe-cases`, not just the STATUS.md claim).
**CloudFront case `de7f9790e656deb8` was approved 2026-08-18** — AWS's own words: "your access
request for Cloudfront has been approved and processed." Bedrock (`178433501800988`) is unchanged:
still `unassigned`, `authorizationStatus: NOT_AUTHORIZED` confirmed live via
`get-foundation-model-availability`, no correspondence since the 2026-08-11 escalation. Not a
day-to-day blocker either way since the AI pipeline already runs on the direct Anthropic API.

Deployed `ClinicWebHostingStack` (S3 + CloudFront + ACM) for real and cut DNS over from the interim
Vercel hosting (live since 2026-08-14) back to CloudFront, per the plan already written into
`dns-stack.ts`'s comments for exactly this moment.

**Real, non-obvious root cause hit and fixed along the way**: the deploy failed twice with
`Certificate validation failed with status: FAILED` before any DNS was touched. Chased this with
real data instead of guessing — requested a standalone ACM certificate directly (bypassing CDK, so
it wouldn't get auto-deleted on failure like the CDK-managed attempts had been, which is exactly
why earlier sessions could never get a real error out of this) and read its actual
`FailureReason`: **`CAA_ERROR`**, and only on `app.havenote.health` — the apex `havenote.health`
validated `SUCCESS`. Confirmed via a real DNS query
(`dns.google/resolve?name=cname.vercel-dns.com&type=CAA`): Vercel's own DNS zone
(`cname.vercel-dns.com`, what `app.havenote.health` was still CNAME'd to) carries a CAA record
authorizing only GlobalSign/Sectigo/Let's Encrypt/Google — **not Amazon**. CAA checks follow CNAME
chains, so as long as the interim Vercel CNAME stayed live, ACM could never issue a cert for
`app.havenote.health`, regardless of DNS record correctness. This had been silently failing every
CloudFront deploy attempt since **2026-08-08** (5 separate failed `RequestCertificate` calls found
in CloudTrail) — a real, pre-existing bug independent of the CloudFront account-verification block,
never diagnosed before because CDK's rollback-on-failure deleted the certificate object (and the
`FailureReason` with it) every single time.
*(Correction: an earlier theory this session — that the failures were caused by stale leftover
validation CNAME records from old attempts — was wrong. Those records were deleted mid-session
based on that theory before the real CAA cause was confirmed; deleting them was harmless since
CloudFormation recreates them deterministically, but it wasn't the actual fix.)*

**Fix**: removed the interim Vercel records from `dns-stack.ts` entirely (both the apex A record
and the `app.` CNAME) rather than trying to route around the CAA restriction — this was always the
intended end state per that file's own comments. This necessarily meant real downtime during the
switch (the CAA-blocking CNAME had to actually be gone before the cert could validate, so a
zero-downtime two-phase approach wasn't possible once the CAA cause was understood). Deployed
`ClinicDnsStack` then `ClinicWebHostingStack` (`--profile clinic-project`). Two more real deploy
issues hit and cleared along the way, same class as documented in this file's earlier CloudFront
cleanup notes: a stuck `REVIEW_IN_PROGRESS` changeset and a retained `clinic-project-web-*` S3
bucket (`RemovalPolicy.RETAIN`) from each failed attempt, both requiring
`aws cloudformation delete-stack` + `aws s3api delete-bucket` before the next retry — hit twice
this session.

**Real outage window, measured not estimated**: Vercel records removed at 13:54:38 UTC
(confirmed via `describe-stack-events`); site confirmed back up via a live `curl` at ~14:04 UTC —
roughly 8-10 minutes of real downtime for `havenote.health`/`app.havenote.health` during the
cutover.

**Verified live, not just deployed**: `curl -sv https://havenote.health` resolves to real CloudFront
edge IPs (`18.165.9.x`), serves the actual Havenote `index.html` (correct title, correct hashed
asset filenames) over a valid TLS connection. `openssl s_client` confirms the live certificate:
`CN=app.havenote.health`, SAN covers `app.havenote.health` + `havenote.health`, issued by Amazon,
valid through 2027-03-04. Both `https://havenote.health` and `https://app.havenote.health` return
200 with matching content. `ClinicWebHostingStack` outputs confirm distribution
`d3ozjvrhc1jtxn.cloudfront.net`. 25/25 infra tests pass, `tsc --noEmit` clean, `cdk synth` clean —
checked before deploying, not after.

**Not yet done, worth a decision**: the Vercel project (`web` under `barseh-gbors-projects`) and its
domain attachments still exist and are simply unused now — not deleted, since CloudFront is what's
actually serving traffic and Vercel costs nothing sitting idle on the free tier. `deploy-web.yml`
(the CI pipeline) still deploys to Vercel on every push to `web/**` — **this is now stale and needs
updating** to deploy to the CloudFront/S3 path instead (`cdk deploy ClinicWebHostingStack`), or the
next frontend change won't actually reach production. Deliberately not done this session — flagging
it as the next real gap rather than leaving it implicit.

## 🟢 Security Risk Assessment completed (2026-08-16)

`compliance/SECURITY-RISK-ASSESSMENT.md` (created earlier 2026-08-16, commit `55657c4`, as part of
the pre-production gate prep below) had its threat table structured and evidence-cited but all 10
rows' Likelihood/Impact/Risk-level columns deliberately left blank — those are risk-tolerance
judgment calls for whoever owns the assessment, not something to pre-fill while building the
system. That work was in progress, uncommitted, when the machine crashed mid-session. Resumed and
finished (commit `3865bc8`):

- All 10 threats rated. **Five came back High**: #3 compromised/malicious admin account, #5
  Anthropic subprocessor (no BAA yet — a live gap, not residual risk), #8 AWS-credential
  exfiltration, #9 DoS (no WAF configured), #10 unauthorized access via a code defect (this exact
  bug class has already happened twice — the 2026-08-11 cross-clinic leak and the 2026-08-15
  frontend admin-route gap).
- Sign-off block filled in: assessed by Barseh Gbor, dated 2026-08-16. **Left honest, not
  overclaimed**: the HHS/ONC Security Risk Assessment Tool cross-check box is marked "no," since
  there's no record that tool was actually run alongside this document — still recommended before
  treating this as final. Next scheduled review set to 2027-08-16 (annual), or sooner if the
  Anthropic BAA status, team size, or subprocessor list changes materially.
- This advances (does not fully close) the "formal HIPAA Security Risk Assessment" pre-production
  gate below — HIPAA doesn't require an external party to perform it, but the HHS/ONC tool
  cross-check and a genuine independent security review are both still outstanding.

## 🟢 Production-readiness Tier 2 work (2026-08-16)

Working through the punch list for what's actually needed before go-live. Tier 1 (legal review,
Anthropic BAA, formal HIPAA risk assessment) is explicitly not engineering work and stays with the
user/counsel. Tier 2 (real engineering hardening) in progress:

- **API rate limiting added.** Confirmed there was genuinely none before adding this (direct
  search, not assumed). `@nestjs/throttler` as a global guard, 100 req/min/IP — generous against
  real usage (`Dashboard.tsx` polls every 15s) while catching a scripted client. No server-side
  login endpoint exists to specifically protect (auth goes straight to Cognito from the browser),
  so this is baseline abuse protection for the authenticated surface, not auth-specific throttling.
  `/health` exempted via `@SkipThrottle()` — confirmed via `compute-stack.ts` that the ALB target
  group hits it every ~15-30s, throttling it would eventually make the ALB mark a healthy task
  unhealthy. 48/48 API tests pass, tsc clean. **Verified live against the real deployed API, not
  just deployed and trusted**: 110 rapid requests to `/users/me` — the first 100 came back `401`
  (unauthenticated, as expected, throttle not yet hit), then `429 Too Many Requests` from request
  101 onward, exactly matching the configured limit. Confirmed `/health` stays `200` under the same
  rapid-fire pattern.
- **RDS back to Multi-AZ.** Was deliberately reverted to single-AZ 2026-08-11 while the pilot was
  blocked on AWS with zero real traffic, on the explicit condition of flipping back once the pilot
  was actually about to go live. Deployed via `cdk deploy ClinicDatabaseStack` (~10.4 min, matching
  the standby-provisioning time expected for this operation) — confirmed live via
  `aws rds describe-db-instances`: `MultiAZ: true`, `Status: available`. Verified zero disruption
  with a live `api.havenote.health/health` check before and after (200 both times).
  **Real deploy collision hit and resolved**: this manual `cdk deploy ClinicDatabaseStack` and
  `deploy-api.yml`'s CI-triggered `cdk deploy ClinicComputeStack` (from the rate-limiting push,
  landed at the same time) both touch the same CDK app's stack set — CI's deploy failed with
  `Stack:...ClinicDatabaseStack is in UPDATE_IN_PROGRESS state and can not be updated`, the same
  collision class documented in this file's 2026-08-11 Config-rules entry. Not a bug in the
  rate-limiting code itself (unit tests, e2e, build, and migration all passed before the collision)
  — waited for the Multi-AZ deploy to fully clear, then re-ran the same CI job via `gh run rerun`
  rather than push a new commit.
- **Incident-response runbook roles filled in.** Security Officer / Privacy Officer / on-call
  engineer were placeholders — now all three are Barseh Gbor (phone/email on file in
  `INCIDENT-RESPONSE-RUNBOOK.md`). Noted the real tradeoff explicitly: one person holding all three
  roles means no backup coverage if that person is unreachable during an actual incident — worth
  revisiting once the team grows. The document itself still needs a legal pass, same status as the
  BAA/privacy policy drafts.
- **Backup-restore drill: done, and it genuinely proved the mechanism works.** Restored RDS
  point-in-time (`aws rds restore-db-instance-to-point-in-time`, `--use-latest-restorable-time`)
  into a brand-new instance (`clinic-project-restore-drill`) — same subnet group/security group as
  the primary so it's reachable via the usual one-off-ECS-task pattern, deliberately single-AZ
  (no value in redundancy for a throwaway verification instance). Queried real row counts on both
  the restored instance and the live primary: `{clinics:1, users:4, patients:13, encounters:13,
  notes:9, audit:22}` — **identical on both**. Also pulled the `testclinician` admin's record off
  the restored instance and confirmed it matched exactly, including the `cognitoSub` synced during
  this session's own admin-account fix. Instance deleted afterward
  (`--skip-final-snapshot`, no new unique data was ever written to it).
- **Load/concurrency test: done.** Minted a real access token via a disposable clinician test
  account (same raw Cognito challenge-sequence technique as earlier verifications), then fired
  genuinely concurrent (backgrounded, not sequential) authenticated requests at `/users/me` — a
  real Prisma-backed query, not the trivial health check. 30 concurrent: 30/30 `200`, 880ms wall
  time for the whole batch (individual latencies 238-623ms, meaning they substantially overlapped,
  not queued). 60 concurrent: 60/60 `200`, 1.78s wall time. No errors, no connection-pool
  exhaustion. Test account cleaned up after.
- **Real gap found and fixed: nobody was actually receiving alerts.** Checked
  `list-subscriptions-by-topic` on `clinic-project-alerts` directly and it came back empty — zero
  subscribers — despite all 10 CloudWatch alarms (9 original + the new `ApiErrorLogsPresent`)
  correctly firing into that topic. Root cause: the original `barsehgbor2026@outlook.com`
  subscription's confirmation email (sent 2026-08-11) was never clicked, and SNS auto-expired the
  pending subscription after a few days. CloudFormation had no visibility into that — it only
  tracks whether the `Subscribe` API call succeeded, not whether it was ever confirmed, so it kept
  reporting `CREATE_COMPLETE` the whole time. Switched the address to `barsehgbor@gmail.com`
  (same as the incident-response runbook contacts) in `infra/bin/infra.ts`, deployed, confirmed
  live: one subscription, `PendingConfirmation` status — **needs the confirmation email clicked to
  actually start receiving alerts**, same failure mode as before if left unconfirmed.
  **Confirmed by the user same day** — re-checked `list-subscriptions-by-topic` directly and the
  subscription now shows a real `SubscriptionArn`, not `PendingConfirmation`. Alert delivery is
  genuinely live end to end: all 10 alarms → SNS topic → confirmed email delivery.
- **Application-level error monitoring added.** Zero error tracking of any kind existed before
  this — checked directly, no Sentry/equivalent in either `api` or `web`'s `package.json`.
  Deliberately went CloudWatch-native (a metric filter matching `"ERROR"` on `/clinic-project/api`,
  feeding the existing `clinic-project-alerts` SNS topic all 9 other alarms already use) instead of
  a third-party tool like Sentry — introducing a new external error tracker would raise the exact
  same new-subprocessor/BAA question as the ICD-10 lookup and Anthropic switch did, and this app
  doesn't have that question yet. Verified live: the filter genuinely exists with the right
  pattern, the alarm is `OK` and correctly wired. Have not triggered a real error to watch it fire
  end-to-end (would need an artificial failure condition, not proportionate here).
  **Also fixed a real drift found along the way**: the RDS Multi-AZ flip earlier in this session
  had been deployed directly via `cdk deploy` but never actually committed — infra and git had
  been out of sync since. Committed now, matches what's live.
  **Hit and resolved a real deploy issue**: an earlier `cdk deploy` got stuck locally on a
  `cdk.out` lock from a concurrent `cdk diff`, but had already reached CloudFormation before being
  killed locally — left `ClinicComputeStack` mid-update server-side, orphaned from local tracking.
  Not a code problem; waited for it to settle, confirmed the API and rate limiter were still
  healthy (still returning `429` correctly), then redeployed cleanly.
- **Explicitly not something engineering can complete**: an independent security review / pen
  test. Everything found and fixed this session (including a real 30-day session-persistence gap)
  came from self-review — which is exactly why an independent second set of eyes matters before
  real go-live, not a substitute for it. This is the one remaining Tier 2 item, and it isn't
  something more engineering work closes.

## 🟢 Business email live: hello@havenote.health (2026-08-16)

Needed for the Anthropic BAA outreach (Sales required a business email, not a personal one).
Set up Zoho Mail's free tier rather than migrate DNS providers — confirmed `havenote.health`'s
DNS is on Route53 (not Cloudflare), so Cloudflare Email Routing would've meant migrating the
whole domain's DNS management just for an inbox; Zoho only needed new records added to the
existing Route53 zone. AWS WorkMail was considered and ruled out — confirmed via research it's
not HIPAA-eligible and AWS is discontinuing it entirely in March 2027, so not viable even setting
compliance aside.

Added to the live `havenote.health` Route53 hosted zone (confirmed no conflicts beforehand — only
existing records were the Vercel A/CNAME entries and ACM validation CNAMEs, no prior MX/mail TXT):
- Zoho domain-ownership verification TXT record
- MX records (mx.zoho.com/mx2.zoho.com/mx3.zoho.com, priorities 10/20/50)
- SPF TXT record, merged into the same record set as the verification TXT (Route53 requires all
  TXT values at one name to live in a single record set, not separate ones)
- DKIM TXT record at `zmail._domainkey.havenote.health`

All four verified live via real external DNS lookups (`nslookup` against Comcast's public
resolver, not just trusting Route53's internal `INSYNC` status), and the live site/API confirmed
unaffected (`havenote.health` and `api.havenote.health/health` both still `200` after the
changes). Mailbox `hello@havenote.health` created in Zoho's console — its actual functionality
isn't DNS-visible, so that part is taken on the user's word, not independently verified.

## 🟢 Pre-production gate prep (2026-08-16)

Four items remain before real patient data can go through this system: legal review/execution of
the BAA + privacy policy, a BAA/DPA with Anthropic, a formal HIPAA Security Risk Assessment, and
an independent security review. None of these can be completed by engineering work alone — each
specifically needs a party other than whoever built the system (counsel, Anthropic's commercial
team, a qualified assessor, an independent reviewer). Built real prep work for each instead of
treating them as pure blockers:

- **`compliance/HIPAA-RISK-ASSESSMENT-EVIDENCE.md`** — every technical safeguard actually built,
  mapped against the real Security Rule categories (45 CFR §164.308/.310/.312). Explicitly labeled
  as evidence for an assessment, not a substitute for one.
- **`compliance/ANTHROPIC-DATA-FLOW-SUMMARY.md`** — exactly what data reaches Anthropic's API,
  cited directly from the real request code, for whoever contacts their commercial team.
- **`compliance/LEGAL-REVIEW-COVER-MEMO.md`** — orients counsel before they read
  `BAA-TEMPLATE.md`/`PRIVACY-POLICY.md`: what's settled, what's placeholder, what's needed from
  the client (pilot clinic's real legal name/address/state) before review can really start.
- **`compliance/SECURITY-REVIEW-SCOPE.md`** — real attack-surface map for an independent reviewer,
  including a list of what's already been found and fixed this project so they don't spend their
  first hours rediscovering it.

Also brought `PILOT-ONBOARDING-RUNBOOK.md`'s pre-launch checklist current — it still assumed the
Bedrock/CloudFront AWS blockers hadn't cleared, stale since the pilot actually went live
2026-08-14 via interim workarounds. Replaced with the actual four remaining gates plus what's
genuinely done.

## 🟢 Fixed blank /metrics screen (2026-08-16)

Reported: clicking "View metrics" as admin led to a blank white screen at `/metrics`. Root cause
confirmed against the real live database and the real live API response, not guessed:
`metrics.service.ts`'s raw `$queryRaw` `AVG()` results come back from Prisma as `Decimal` objects.
`Decimal.toJSON()` returns a **string**, so the actual wire response sent
`"avgEditsPerNote":"1"` (a JSON string) instead of a number, despite `MetricsSummary`'s TS type
promising `number | null`. `Metrics.tsx` calls `summary.avgEditsPerNote.toFixed(1)` assuming a
real number — `.toFixed` doesn't exist on `String.prototype`, so it threw. The clinic had already
genuinely accumulated a `note.edit` audit entry, so this was live and reproducible, not
theoretical — confirmed by replicating the exact query against the real DB (`constructor.name:
Decimal`) and by simulating the real `JSON.stringify`/`JSON.parse` wire round trip to reproduce
the exact browser-side `TypeError`. Confirmed `avgSatisfactionRating` was **not** affected —
Prisma's ORM-level `_avg` on an `Int` column correctly returns a plain number; the bug was
isolated to the two `$queryRaw`-derived fields.

Fixed at the source: explicit `Number(...)` conversion in `metrics.service.ts`, so the API
actually delivers what its own types promise.

Also fixed the reason this was a *blank screen* instead of a visible error: **zero error
boundaries existed anywhere in this app** (confirmed via direct search) — any uncaught render
exception silently unmounts the whole React tree. Added `components/ErrorBoundary.tsx`, wrapped
around `<Routes>` in `App.tsx`, keyed by pathname so navigating to a different page after a crash
remounts cleanly; the topbar sits outside the boundary so Sign out/navigation stay usable even if
one page crashes.

51/51 API tests pass (3 new), 77/77 web tests pass (2 new), tsc/lint clean, local prod build
verified. Deployed via both `deploy-api.yml` and `deploy-web.yml`, both succeeded.
**Verified live against production, not just deployed**: minted a real admin token via the usual
disposable-account Cognito challenge sequence, called the real `https://api.havenote.health`
metrics endpoint directly, and confirmed the actual JSON response now reads
`"avgEditsPerNote":1` — a genuine unquoted number, not the string `"1"` from before. Test account
and DB row deleted afterward.

## 🟢 Admin Reset MFA action, for hardware-TOTP clinicians who lose their token (2026-08-16)

Follow-up to the hardware-TOTP discussion (a phone-free MFA option for clinicians without
smartphones): the one real gap was that resetting a stuck/lost MFA enrollment required an engineer
running raw AWS CLI commands (exactly what this session did manually for the admin account and for
barsehgbor's account). Built a real admin-facing **Reset MFA** action in **Users**.

- `PATCH /users/:id/reset-mfa` (`users.controller.ts`/`users.service.ts`),
  admin-only, clinic-scoped, matching the deactivate/reactivate pattern. Blocks self-reset (would
  orphan your own current session mid-request, and can't help real lockout recovery anyway since
  reaching the endpoint requires an already-valid session) and blocks resetting a deactivated
  account.
- Cognito's admin API has no way to un-associate a verified TOTP device — confirmed again live
  this session — so this deletes and recreates the Cognito user (same technique used manually
  earlier), re-adds the correct group from the target's `role`, syncs the new `cognitoSub`, and
  audit-logs as `user.mfa_reset`. Recreating always issues a new temp password too (Cognito
  requires one on create) — framed honestly in the UI ("Resetting MFA also issues a new temporary
  password by email") rather than pretending it's MFA-only. No IAM changes needed —
  `AdminDeleteUser`/`AdminCreateUser`/`AdminAddUserToGroup` were already granted for
  invite/deactivate.
- `PILOT-ONBOARDING-RUNBOOK.md` now documents hardware-TOTP enrollment (must be a *seedable* token
  — Cognito always generates its own secret, so a fixed-seed token like old RSA SecurID hardware
  cannot work here) and the Reset MFA procedure.
- 48/48 API tests pass (4 new), 75/75 web tests pass (3 new), tsc/lint clean, local prod build
  verified. Deployed via both `deploy-api.yml` and `deploy-web.yml` (this change touched both),
  both confirmed live (`api.havenote.health/health` and `havenote.health` → 200).
- **Verified with a real end-to-end call against the live API, not just CI's unit tests**:
  created disposable admin + clinician test accounts, drove the admin through the actual Cognito
  auth-challenge sequence via raw API calls (no browser needed this time — computed the TOTP code
  from a real `AssociateSoftwareToken` secret, same RFC 6238 approach as the earlier Playwright
  verification) to get a genuine access token, then called `PATCH /users/:id/reset-mfa` against
  `https://api.havenote.health` for real. Confirmed directly: the old Cognito sub was truly gone
  (`UserNotFoundException`), the new one was correctly in the `clinician` group, and a real
  `user.mfa_reset` audit log row was written with the right actor/target. All test accounts and
  rows deleted afterward.

## 🔴 Session-persistence security gap found and fixed (2026-08-16)

Reported: a clinician's phone was still signed into Havenote a full day after last use, no
password or MFA re-entry. Confirmed live via `describe-user-pool-client`: `RefreshTokenValidity`
was Cognito's **default 30 days**. `amazon-cognito-identity-js` silently mints fresh access/ID
tokens off the refresh token on every session check, so a lost, stolen, or shared phone had
standing PHI access for up to a month with zero re-authentication — MFA included. Three real,
compounding gaps, all fixed (commit `233a559`):

1. **`auth-stack.ts`**: refresh token validity was never a deliberate choice, just Cognito's
   unbounded default. Now explicit — 30 min access/ID tokens, 12 hour refresh token (covers a
   full clinical shift, guarantees at least daily re-auth+MFA).
2. **`useIdleTimer.ts`**: the existing 15-minute idle-logout was pure client-side `setInterval`,
   which mobile browsers throttle or fully suspend in a backgrounded tab — it could silently never
   fire. Very likely the literal mechanism behind the report. Now persists the last-activity
   timestamp to `localStorage` and checks it immediately on `visibilitychange`/`focus`, so a
   resumed tab is caught even if its interval never ran while backgrounded.
3. **`cognito.ts`**: `logout()` only cleared local tokens — a captured/copied token kept working
   until natural expiry regardless of "signing out." Now also calls `globalSignOut()` (Cognito's
   `EnableTokenRevocation` was already `true`, just never invoked), revoking every session for that
   user, not just the current device.

The new policy only applies to tokens minted after the deploy, so also ran
`admin-user-global-sign-out` against all 4 existing Cognito users right after deploying —
forces immediate re-authentication everywhere, closing the gap for already-active sessions too,
not just future logins. One of the 4 accounts (`bawuluw@gmail.com`) wasn't one this session had
prior context on — signed out along with the rest as part of the blanket fix, worth confirming
who that is.

72/72 web tests pass (3 new, covering the actual resume/visibility-change fix — not just the
config change), 25/25 infra tests unaffected, `tsc`/lint clean, `cdk diff` confirmed non-replacing.
Deployed and verified live via `describe-user-pool-client`. Frontend deployed via the normal
`deploy-web.yml` pipeline, confirmed live.

**Broader security-posture pass done alongside this fix** (not a from-scratch re-audit of
everything — citing what this project has already verified live in prior sessions, plus what was
freshly checked today):
- **Authorization is solid, freshly re-confirmed today**: `RolesGuard` reads `cognito:groups` off
  a cryptographically verified access token (`CognitoJwtVerifier`), not client-supplied data — this
  is what made the 2026-08-15 admin-route-guard bug purely a frontend/UX issue, not a real
  privilege-escalation hole. `/invite`, `/users`, `/metrics` also now have client-side `AdminRoute`
  guards as defense in depth.
- **Encryption**: media bucket SSE-KMS (customer-managed key), RDS encrypted, TLS everywhere —
  established in Phase 4, not re-verified today.
- **MFA is mandatory** pool-wide (`Mfa.REQUIRED`), not optional — confirmed live today while fixing
  the QR-code issue.
- **Audit logging**: application-level `AuditLog` table on every note edit/sign/deactivate/data-request,
  plus account-wide CloudTrail — established in Phase 4/2026-07-19, not re-verified today.
- **Infra hardening**: CloudWatch alarms + AWS Config rule pack (16 managed rules, GuardDuty
  enabled) — built 2026-08-11, not re-verified today.
- **Not done in this pass, worth a decision**: a self-service "sign out of all my devices" button
  for a clinician who suspects their own device is compromised, without needing an admin. Currently
  that capability only exists via the admin deactivate/reactivate flow. Also not done: rotating the
  actual Cognito signing keys (not necessary here — the gap was token *lifetime*, not a key
  compromise).

## 🟢 Grounded ICD-10 suggestions via tool use (2026-08-16)

`suggestedCodes` was pure model recall with no way to verify a code was real before it reached a
clinician — the code picker's own copy already admits this ("verify before billing"). Added a
`search_icd10_codes` tool backed by a local, self-hosted lookup
(`infra/lambda/process-transcript/icd10-common.ts`, mirrored from the existing
`web/src/data/icd10-common.ts` the code picker already uses — the two aren't shared across the
workspace boundary, kept in sync by hand, low risk given ~60 entries) and a bounded tool-use loop
in `callAnthropicWithTools` that runs the search and feeds results back to the model before it
finalizes `suggestedCodes`. Deliberately **not** a third-party coding API — that would add a new
subprocessor touching PHI-adjacent assessment text and a new BAA requirement; ICD-10-CM is a
public CMS-published set, so this stays entirely inside existing infra, no new subprocessor, no
new legal-review item.

`generateSoapNote`'s signature is unchanged, so all 16 existing fixture tests pass untouched.
Added 8 new tests: the tool round trip end to end, the tool being advertised on every call, a
bounded-loop guard (throws rather than looping forever if a model misbehaves), and direct coverage
of `searchIcd10Codes`. 25/25 infra tests pass, `tsc`/`cdk synth` clean.

**Verified twice against a real strep-throat transcript, not just trusted:** first pass, the note
correctly suggested `J02.0` — but a correct code alone doesn't prove the tool actually fired, since
J02.0 is common-knowledge territory for the model. Added a permanent (not scaffolding)
`icd10_tool_call` log line — the only visibility into whether the grounding tool is actually being
used in production short of reading raw Anthropic API traffic — redeployed, re-ran the same real
transcript, and confirmed directly via CloudWatch: the model genuinely called
`search_icd10_codes` with `"streptococcal pharyngitis"` and got exactly 1 real match back, which is
what it used. Test patient/encounter/note rows and the test S3 object deleted after both runs.

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

2. ~~**CloudFront account verification**~~ — **RESOLVED 2026-08-18/19.** Case
   `de7f9790e656deb8` was approved by AWS 2026-08-18. `ClinicWebHostingStack` deployed for real
   2026-08-19 and `havenote.health`/`app.havenote.health` now serve via CloudFront, cut over from
   the interim Vercel hosting — see the 🟢 CloudFront cutover entry above for the full story,
   including a real CAA-related root cause found along the way (unrelated to this AWS case) that
   also had to be fixed before the cert would validate. **Still open**: `deploy-web.yml` (CI) still
   deploys to Vercel on every push — needs updating to target `ClinicWebHostingStack` or the next
   frontend change won't reach the now-live CloudFront production.

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
- **Minimum retention requirement — Pennsylvania used as a working example, not yet confirmed**
  (2026-07-19; corrected 2026-08-17 — no clinic has actually been signed as a pilot partner, so
  earlier "pilot clinic is in Pennsylvania" phrasing here and in `RETENTION-POLICY.md` was stale
  placeholder framing, not a real fact): 49 Pa. Code § 16.95 requires ≥7 years from last visit
  (longer for minors), used as a worked example. Indefinite retention of
  `clinical_notes`/`transcripts` (already-built, no auto-deletion) satisfies this regardless of
  which state ultimately applies once a real pilot clinic is identified. See
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
