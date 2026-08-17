# Havenote — Independent Security Review: Request for Proposal

**Issued:** 2026-08-16
**Contact:** Barseh Gbor, hello@havenote.health

## What we're asking for

Havenote needs an independent security assessment before real patient data goes through it. We're
a single engineer/founder who built and reviewed this system ourselves, which is exactly why we
need a second, independent set of eyes rather than treating our own testing as sufficient. We're
looking for a firm or independent consultant to perform a web application and cloud infrastructure
security review, deliver a written report of findings with severity ratings and remediation
guidance, and be available for a brief follow-up conversation once we've addressed the findings.

This is a small, single-tenant pilot-stage application, not an enterprise system. We're looking for
a proposal scoped and priced accordingly, not a full enterprise engagement.

## About Havenote

A clinical documentation SaaS: a clinician records a patient visit in-browser, the audio is
transcribed (AWS Transcribe Medical), an AI drafts a structured SOAP note (Anthropic Claude, called
directly via API), the clinician reviews/edits/signs it, and it's exported as a PDF. Pre-launch —
no external clinic has been signed as a pilot partner yet (the one clinic in the system is
internal test data), and real patient data has not been onboarded anywhere (still pending legal
review and this security review, among other gates), so testing against the live/production
environment carries no real-PHI risk.

## Scope

**In scope:**
- `https://havenote.health` / `https://app.havenote.health` — React SPA frontend (hosted on Vercel)
- `https://api.havenote.health` — NestJS backend API on AWS ECS Fargate
- Authentication and session handling (AWS Cognito, mandatory TOTP MFA)
- Authorization and multi-tenant data isolation (clinic-scoped access controls)
- The AWS infrastructure supporting the above (VPC, RDS, S3, Lambda, Step Functions, IAM) — cloud
  configuration review, not full infrastructure penetration testing, unless proposed separately
- Data flows to third parties (AWS Transcribe Medical, Anthropic API) — reviewing what leaves the
  environment and how, not the third parties' own security posture

**Out of scope:**
- Physical security, social engineering/phishing of personnel, and denial-of-service testing
  against production (DoS testing, if desired, should be proposed and scheduled separately against
  a non-production target)
- The pilot clinic's own physical premises, devices, or network

A detailed attack-surface map, current architecture, authentication/authorization design, data flow
diagram, and a list of vulnerabilities already found and fixed in prior internal review (so you
don't spend billable hours rediscovering known issues, though we'd still like them verified as
actually fixed) is provided in the attached `SECURITY-REVIEW-SCOPE.md`.

## Testing environment

Test accounts (admin and clinician roles) will be provisioned for you against the live environment
listed above. As noted, no real patient data exists in the system yet, so live-environment testing
is acceptable. We ask that any test data you create be clearly identifiable as test data and that
you notify us before/after any testing window so we can distinguish your activity from a real
incident in our monitoring (we have CloudWatch alarms and GuardDuty active and will otherwise treat
unusual activity as a live security event).

## What we're looking for in a proposal

- Relevant experience: web application penetration testing, cloud (ideally AWS) security review,
  and healthcare/HIPAA-context experience preferred but not required
- Methodology (e.g., OWASP ASVS/Testing Guide alignment, or your own framework)
- Sample or redacted example of a past findings report, if available
- Timeline and estimated level of effort
- Fixed-price or not-to-exceed quote preferred over open-ended hourly billing, given the project's
  size
- Whether a follow-up retest of remediated findings is included or available as an add-on

## Deliverables expected

- A written report: findings with severity ratings (a standard scale such as CVSS or your own is
  fine, just state which), reproduction steps, and remediation guidance
- A short executive summary suitable for a non-technical stakeholder and for supporting a HIPAA
  Security Risk Assessment
- Availability for a brief call to walk through findings

## Timeline

We'd like to receive proposals within two weeks of this document's issue date, with the engagement
itself scheduled at your earliest reasonable availability after that. We don't have a hard deadline
beyond wanting this closed out before onboarding real patient data, but sooner is better.

## How to respond

Send a proposal to hello@havenote.health including your approach, timeline, and pricing. Happy to
answer scoping questions by email or a short call before you finalize a quote.

---

*Reference: see the accompanying `compliance/SECURITY-REVIEW-SCOPE.md` for the full technical
attack-surface map, architecture notes, and prior-findings list referenced above.*
