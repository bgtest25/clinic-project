# Havenote — Security Risk Assessment

**Status:** likelihood/impact/risk-level ratings completed 2026-08-16 by Barseh Gbor, walked
through threat-by-threat rather than filled in at once. This satisfies the *existence* requirement
of 45 CFR §164.308(a)(1)(ii)(A) once signed and dated below. HIPAA does not require an external
party to do this — the primary recommended tool alongside this document is the free HHS/ONC
**Security Risk Assessment Tool** (healthit.gov/privacy-security/security-risk-assessment-tool/),
a 125-question wizard/Excel tool built for exactly this. This document is meant to be used
together with that tool, not instead of it.

**What's filled in here:** the actual technical controls in place, cited to real evidence (code,
live verification, or prior audit dates in `memory/STATUS.md`) — not asserted from memory. The
likelihood/impact/risk-level ratings are the assessment owner's own judgment calls, not pre-filled
by whoever built the system being assessed.

**Five threats rated High risk on 2026-08-16**: #3 (compromised/malicious admin account), #5
(Anthropic subprocessor — no BAA yet, a live gap not a residual risk), #8 (data exfiltration via a
compromised AWS credential), #9 (DoS — no WAF configured), and #10 (unauthorized access from a code
defect — this exact bug class has already happened twice, and a third instance was found and fixed
2026-08-31 — see row 10). **Three re-rated 2026-08-31**: #5 (Anthropic replaced by Bedrock, no
longer a subprocessor), #3 (a real admin-activity anomaly alarm now exists where there was
previously only generic visibility), and #9 (a WAF is now confirmed live on the ALB) all moved to
**Medium**. **Two threats remain High as of 2026-08-31**: #8, and #10 (deliberately not downgraded
despite new test coverage, given a third live instance of this bug class was just found).

Worth a deliberate remediation decision on the remaining two before this assessment is
considered closed out, not just filed away.

**Asset inventory, in detail:** see `compliance/HIPAA-RISK-ASSESSMENT-EVIDENCE.md` — not repeated
here.

---

## Threat and vulnerability analysis

| # | Threat/vulnerability | Current controls (verified, not assumed) | Likelihood | Impact | Risk level | Notes / remediation |
|---|---|---|---|---|---|---|
| 1 | Compromised clinician credentials (phishing, credential stuffing, weak password) | Mandatory TOTP MFA pool-wide; 12-hour refresh token / 30-min access token ceiling (tightened 2026-08-16 from Cognito's 30-day default); password policy (12-char minimum, mixed case/digits/symbols); rate limiting on the API | Medium | Medium | Medium | Cognito's own built-in account-lockout/adaptive-authentication settings haven't been separately reviewed — worth confirming as part of this assessment |
| 2 | Lost/stolen clinician device with an active session | 15-min idle timeout, resilient to backgrounded mobile tabs via a persisted-timestamp resume-check (found and fixed 2026-08-16 — the original implementation could silently fail to fire on a backgrounded tab); 12-hour refresh-token ceiling limits the outer bound regardless; admin can force `AdminUserGlobalSignOut` + deactivate | Medium | Medium | Medium | No self-service "sign out of all my devices" for a clinician who suspects their own device is compromised — currently admin-only |
| 3 | Compromised or malicious admin account | Same MFA/session controls as #1/#2; every admin action writes an `AuditLog` row (including `invite`, which was missing this until 2026-08-31 — see notes); admins are clinic-scoped even for their own clinic's data (can't see other clinics); admin Reset MFA action itself is audit-logged and clinic-scoped. **2026-08-31: real anomaly detection added** — a CloudWatch alarm (`AdminActionBurst`, deployed and confirmed `UPDATE_COMPLETE`) fires on more than 10 admin actions (invite/deactivate/reactivate/MFA-reset) in a 5-minute window, closing the previously-noted gap | Low | High | Medium | Threshold (10/5min) is a judgment call for this project's current scale (single-digit users per clinic) — revisit as the team/pilot grows and legitimate bulk onboarding becomes more common. Re-rated 2026-08-31 by this session (Likelihood Medium→Low) now that real detection exists where there was previously only generic CloudTrail/GuardDuty visibility — same reasoning pattern as row 5's re-rate, worth your own sanity check |
| 4 | SQL injection / API-layer attack | Prisma ORM parameterizes all standard queries; the two raw `$queryRaw` calls in `metrics.service.ts` use tagged-template parameter binding (not string concatenation); `ValidationPipe({ whitelist: true, transform: true })` globally rejects unexpected request fields; rate limiting added 2026-08-16 | Low | High | Medium | |
| 5 | Third-party subprocessor breach or misuse (AWS) | AI drafting now calls the model through AWS Bedrock, not Anthropic's API directly (`infra/lambda/process-transcript/index.ts`, confirmed live via a real Bedrock invocation and a real deployed-Lambda test) — Anthropic is no longer a subprocessor of this system, leaving AWS as the sole subprocessor. AWS: BAA confirmed active (`aws artifact list-customer-agreements`, effective 2026-07-17), mature independently-audited security program (SOC 2/HITRUST-class controls under the shared-responsibility model), data encrypted at rest (KMS, customer-managed key on the media bucket) and in transit (TLS) limiting exposure even in a breach scenario | Low | High | Medium | **Re-rated 2026-08-31** (was Medium/High/High on 2026-08-16). Likelihood dropped from Medium to Low: the 2026-08-16 Medium rating reflected two subprocessors, one (Anthropic) with no BAA, no contractual security assurances, and unverified data-handling practices — a real elevated-likelihood factor. With only AWS remaining — a mature, audited, BAA-covered provider, the same profile already rated Low for threat #7's infrastructure-attack scenario — Low is consistent with this document's own rating pattern. Impact stays High (any subprocessor breach exposing PHI is high-impact regardless of subprocessor count), which nets to Medium per the same Low+High→Medium pattern used for threat #4. Re-rated by this session at your explicit request, not by the original assessment owner — worth a quick sanity check against your own risk tolerance, not just accepted on the reasoning alone |
| 6 | Insider threat (single team member currently holds broad access) | All actions audit-logged; least-privilege IAM grants (reviewed 2026-07-18, found 5 justified wildcards, no hardcoded secrets) | Low | Medium | Low | At current team size (one person), broad access is a structural reality, not a fixable gap — document as an accepted risk at this stage and revisit as the team grows |
| 7 | Ransomware / destructive attack on infrastructure | RDS automated backups (7-day retention) **and a real point-in-time restore proven to work** (2026-08-16 drill: restored instance's data matched the live primary exactly, not just configured and assumed); RDS Multi-AZ (automatic failover) | Low | Low | Low | |
| 8 | Data exfiltration via a compromised AWS credential | CloudTrail (account-wide), GuardDuty enabled, 16 AWS Config managed rules with NON_COMPLIANT alerts routed to the same monitoring pipeline as CloudWatch alarms; data encrypted at rest limits what's actually readable even if exfiltrated | Medium | High | High | |
| 9 | Denial of service / resource exhaustion | API rate limiting (100 req/min/IP, verified live 2026-08-16); AWS's baseline infrastructure-level DDoS protection on the ALB. **2026-08-31: a WAF (`AWS::WAFv2::WebACL`, `clinic-project-api-waf`) added and confirmed live** — a 2000-req/5-min-per-IP rate-based rule plus AWS's Common/KnownBadInputs/IpReputation managed rule groups, associated with the real production ALB (confirmed via `aws wafv2 get-web-acl-for-resource` against the actual load balancer ARN, not just a successful `cdk deploy`) | Low | High | Medium | Re-rated 2026-08-31 (Likelihood Medium→Low) now that a real WAF is confirmed attached to the ALB in production, not just added in code — same Low+High→Medium pattern as rows 3 and 5 |
| 10 | Unauthorized data access due to a code defect (missed authorization check) | `RolesGuard` + clinic-scoping pattern enforced via a single chokepoint (`UsersService.findByCognitoSub`) that most services call first; JWT claims independently re-verified server-side, never trusted from the client. **2026-08-31: real authorization-boundary test coverage added** — 26 new tests across `users`/`notes`/`recordings`/`patients`/`patient-data-requests` asserting the clinic-ownership check actually fires at each call site, not just that it exists somewhere | High | High | High | **A third real instance of this exact bug class was found and fixed 2026-08-31**, while adding the test coverage above: `UsersService.invite()` trusted a client-supplied `clinicId` with zero server-side check, letting any admin invite a user (including another admin) into a different clinic via a direct API call — live since this endpoint was built, never triggered through the UI, never caught until this session tested it directly. Deliberately **not** re-rated down despite the new tests: a third live finding of the same bug class (after 2026-08-11 and 2026-08-15) is evidence this is a persistent pattern in how this codebase gets built, not a closed gap — the new tests cover what they cover, not a guarantee against the next missed check |

## Sign-off

**Assessed by:** Barseh Gbor
**Date:** 2026-08-16 (full assessment); rows 3, 5, 9, and 10 revised 2026-08-31 (Bedrock switch,
WAF added, admin-activity alarm added, a real authorization vulnerability found/fixed and test
coverage added) — point revisions to specific rows, not a full re-walk of all ten threats. Worth a
full re-review before this is treated as current on every row.
**Reviewed alongside:** HHS/ONC Security Risk Assessment Tool — ☐ yes ☑ no (not yet run; recommended before this assessment is treated as final)
**Next scheduled review:** 2027-08-16 (annual), or sooner if team size or a new subprocessor changes materially.
