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
defect — this exact bug class has already happened twice). **Note (2026-08-31): the underlying fact
behind #5's rating has changed** — the AI pipeline now calls the model through AWS Bedrock instead
of Anthropic's API directly, so Anthropic is no longer a subprocessor of this system at all (see row
5 below and `memory/STATUS.md`). The Likelihood/Impact/Risk-level ratings below are left as the
assessment owner recorded them 2026-08-16, per this document's own stated practice that ratings are
the owner's judgment call, not something to silently overwrite — but #5 in particular is now stale
and worth a deliberate re-rating at the next review, not treated as still-High by default.

Worth a deliberate remediation decision on the remaining four before this assessment is
considered closed out, not just filed away.

**Asset inventory, in detail:** see `compliance/HIPAA-RISK-ASSESSMENT-EVIDENCE.md` — not repeated
here.

---

## Threat and vulnerability analysis

| # | Threat/vulnerability | Current controls (verified, not assumed) | Likelihood | Impact | Risk level | Notes / remediation |
|---|---|---|---|---|---|---|
| 1 | Compromised clinician credentials (phishing, credential stuffing, weak password) | Mandatory TOTP MFA pool-wide; 12-hour refresh token / 30-min access token ceiling (tightened 2026-08-16 from Cognito's 30-day default); password policy (12-char minimum, mixed case/digits/symbols); rate limiting on the API | Medium | Medium | Medium | Cognito's own built-in account-lockout/adaptive-authentication settings haven't been separately reviewed — worth confirming as part of this assessment |
| 2 | Lost/stolen clinician device with an active session | 15-min idle timeout, resilient to backgrounded mobile tabs via a persisted-timestamp resume-check (found and fixed 2026-08-16 — the original implementation could silently fail to fire on a backgrounded tab); 12-hour refresh-token ceiling limits the outer bound regardless; admin can force `AdminUserGlobalSignOut` + deactivate | Medium | Medium | Medium | No self-service "sign out of all my devices" for a clinician who suspects their own device is compromised — currently admin-only |
| 3 | Compromised or malicious admin account | Same MFA/session controls as #1/#2; every admin action writes an `AuditLog` row; admins are clinic-scoped even for their own clinic's data (can't see other clinics); admin Reset MFA action itself is audit-logged and clinic-scoped | Medium | High | High | No automated anomaly detection on unusual admin activity patterns (e.g. mass user creation) beyond generic CloudTrail/GuardDuty visibility |
| 4 | SQL injection / API-layer attack | Prisma ORM parameterizes all standard queries; the two raw `$queryRaw` calls in `metrics.service.ts` use tagged-template parameter binding (not string concatenation); `ValidationPipe({ whitelist: true, transform: true })` globally rejects unexpected request fields; rate limiting added 2026-08-16 | Low | High | Medium | |
| 5 | Third-party subprocessor breach or misuse (AWS) | **Updated 2026-08-31**: AI drafting now calls the model through AWS Bedrock, not Anthropic's API directly (`infra/lambda/process-transcript/index.ts`, confirmed live via a real Bedrock invocation and a real deployed-Lambda test) — Anthropic is no longer a subprocessor of this system. AWS: BAA confirmed active (`aws artifact list-customer-agreements`, effective 2026-07-17), data encrypted at rest (KMS) and in transit (TLS) limiting exposure even in a breach scenario | Medium | High | **Needs re-rating** | Rated High 2026-08-16 specifically because of the Anthropic no-BAA gap, which no longer exists — this row's rating should be revisited at the next review rather than carried forward unchanged. See `compliance/ANTHROPIC-DATA-FLOW-SUMMARY.md` for the now-superseded direct-Anthropic architecture this replaced |
| 6 | Insider threat (single team member currently holds broad access) | All actions audit-logged; least-privilege IAM grants (reviewed 2026-07-18, found 5 justified wildcards, no hardcoded secrets) | Low | Medium | Low | At current team size (one person), broad access is a structural reality, not a fixable gap — document as an accepted risk at this stage and revisit as the team grows |
| 7 | Ransomware / destructive attack on infrastructure | RDS automated backups (7-day retention) **and a real point-in-time restore proven to work** (2026-08-16 drill: restored instance's data matched the live primary exactly, not just configured and assumed); RDS Multi-AZ (automatic failover) | Low | Low | Low | |
| 8 | Data exfiltration via a compromised AWS credential | CloudTrail (account-wide), GuardDuty enabled, 16 AWS Config managed rules with NON_COMPLIANT alerts routed to the same monitoring pipeline as CloudWatch alarms; data encrypted at rest limits what's actually readable even if exfiltrated | Medium | High | High | |
| 9 | Denial of service / resource exhaustion | API rate limiting (100 req/min/IP, verified live 2026-08-16); AWS's baseline infrastructure-level DDoS protection on the ALB | Medium | High | High | No WAF configured — a real, not-yet-addressed gap worth this assessment explicitly weighing |
| 10 | Unauthorized data access due to a code defect (missed authorization check) | `RolesGuard` + clinic-scoping pattern enforced via a single chokepoint (`UsersService.findByCognitoSub`) that most services call first; JWT claims independently re-verified server-side, never trusted from the client | High | High | High | Real prior history of exactly this bug class: a cross-clinic data leak was found and fixed 2026-08-11, and a frontend-only admin-route gap was found and fixed 2026-08-15 (the backend correctly blocked the actual privilege escalation both times). No automated test suite specifically targets authorization boundaries — relies on manual audit, which has caught issues but is not a systemic guarantee |

## Sign-off

**Assessed by:** Barseh Gbor
**Date:** 2026-08-16
**Reviewed alongside:** HHS/ONC Security Risk Assessment Tool — ☐ yes ☑ no (not yet run; recommended before this assessment is treated as final)
**Next scheduled review:** 2027-08-16 (annual), or sooner if team size or a new subprocessor changes materially. **2026-08-31: the Anthropic-BAA trigger condition fired** — the AI pipeline was switched to AWS Bedrock, removing Anthropic as a subprocessor entirely (see row 5 above); this alone is reason enough to bring the review forward rather than wait for the annual date, since it changes one of the five High-risk ratings
