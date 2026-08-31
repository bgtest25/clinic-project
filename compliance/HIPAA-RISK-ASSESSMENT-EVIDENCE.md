# Havenote — HIPAA Security Risk Assessment: Technical Evidence Packet

**What this is:** an inventory of technical controls actually built and verified in this system,
organized against the HIPAA Security Rule's three safeguard categories (45 CFR §164.308/.310/.312).
**What this is not:** a Security Risk Assessment. A risk assessment is a distinct exercise — threat
identification, likelihood/impact analysis, and documented risk-acceptance decisions — that
requires a qualified assessor's judgment, not a list of controls. This packet exists so that
assessor starts from "here's what's built, verify and evaluate it" instead of a blank page.

Every claim below is either (a) verified live against the running system as of the date noted, or
(b) a citation to a specific file/line in this repository. Nothing here is asserted from memory.

**Last verified:** 2026-08-16, business-associate row updated 2026-08-31.

---

## Administrative Safeguards (45 CFR §164.308)

| Requirement | Status | Evidence |
|---|---|---|
| Security management process — risk analysis | **Not done — this document is prep for it, not a substitute** | This packet; no formal risk analysis has been performed |
| Security management process — sanction policy | Not started | No documented workforce sanction policy exists |
| Workforce security — authorization/supervision | Implemented | Role-based access via Cognito groups (`admin`/`clinician`), enforced server-side by `RolesGuard` reading verified JWT claims — `api/src/auth/roles.guard.ts` |
| Information access management | Implemented | Every clinic-scoped service resolves the caller via `UsersService.findByCognitoSub` and scopes all queries to `clinicId` — `api/src/users/users.service.ts`. A 2026-08-11 audit found and fixed a cross-clinic data leak across patients/encounters/recordings/notes/metrics (see `memory/STATUS.md`) |
| Security awareness and training | Not started | No formal workforce training program exists — team size is currently one person |
| Security incident procedures | Implemented | `compliance/INCIDENT-RESPONSE-RUNBOOK.md` — detection sources, triage, containment menu, breach-notification analysis, named contacts (Security Officer/Privacy Officer/on-call, filled in 2026-08-16). Document itself still needs a legal pass |
| Contingency plan — data backup | Implemented and **proven**, not just configured | RDS automated backups (7-day retention). A real point-in-time restore drill (2026-08-16) confirmed the restored instance's row counts matched the live primary exactly — not assumed, verified |
| Contingency plan — disaster recovery / emergency mode | Partial | RDS Multi-AZ live (automatic failover to a standby). No documented DR runbook beyond the incident-response runbook's containment section |
| Evaluation | Ongoing, informal | Multiple live security audits this project (2026-08-11, 2026-08-15, 2026-08-16) found and fixed real issues — see `memory/STATUS.md` for the full history. Not a substitute for a scheduled, formal evaluation cadence |
| Business associate contracts | **Partial** | AWS BAA: confirmed **ACTIVE** via `aws artifact list-customer-agreements` (effective 2026-07-17), now covers the AI drafting call too since it moved to AWS Bedrock 2026-08-31 (see Technical Safeguards below) — Anthropic is no longer a direct subprocessor of this system. Clinic BAA: `compliance/BAA-TEMPLATE.md`, drafted, not reviewed by counsel, not executed — this remains the actual gate |

## Physical Safeguards (45 CFR §164.310)

| Requirement | Status | Evidence |
|---|---|---|
| Facility access controls | Inherited from AWS | All infrastructure is AWS-hosted (ECS Fargate, RDS, S3, Lambda) — physical security is AWS's responsibility under the shared responsibility model, covered by AWS's own compliance program and the active AWS BAA |
| Workstation use / security | Partial | MFA is mandatory pool-wide (`cognito.Mfa.REQUIRED` — `infra/lib/auth-stack.ts`); no device-management/MDM policy exists for clinician workstations, since none is currently required by the app |
| Device and media controls | Implemented | Media (audio) bucket is SSE-KMS encrypted with a customer-managed key; raw audio is deleted on note sign-off with a 90-day lifecycle backstop for anything that never reaches signed — `compliance/RETENTION-POLICY.md` |

## Technical Safeguards (45 CFR §164.312)

| Requirement | Status | Evidence |
|---|---|---|
| Access control — unique user identification | Implemented | Every user has a unique Cognito identity; `User.cognitoSub` maps 1:1 |
| Access control — automatic logoff | Implemented, verified live | 15-minute idle timeout, resilient to backgrounded mobile tabs via a persisted-timestamp check on resume (not just a live interval) — `web/src/auth/useIdleTimer.ts`. Access token validity 30 min, refresh token validity 12 hours — tightened 2026-08-16 after finding the previous 30-day Cognito default left a real session-persistence gap (confirmed live, then fixed) |
| Access control — encryption/decryption | Implemented | TLS in transit everywhere; KMS customer-managed keys for the media bucket and RDS storage encryption |
| Audit controls | Implemented | Application-level `AuditLog` table on every sensitive action (note sign/edit/amend, deactivate/reactivate, MFA reset, data-request log/resolve); account-wide CloudTrail; CloudWatch — 11 alarms covering RDS/ALB/ECS/Lambda/Step Functions/application-error-logs, all wired to a confirmed, live email subscription (verified 2026-08-16, not just configured — the original subscription's confirmation had silently expired and gone unnoticed for 5 days before this was caught) |
| Integrity | Implemented | Signed notes are locked; edits after signing create versioned amendments, never silent overwrites. Audit log is append-only. Backup-restore drill (above) directly verified data integrity survives a real restore |
| Person or entity authentication | Implemented | Cognito password + mandatory TOTP MFA; hardware-TOTP-token support confirmed viable for clinicians without smartphones (same RFC 6238 protocol, no code change needed); every API request re-verified server-side via `CognitoJwtVerifier` against Cognito's public keys — not client-trusted data |
| Transmission security | Implemented | TLS on all connections including the application database connection; CORS locked to the two real frontend origins |

---

## Additional technical hardening not mapped to a specific citation above

- API rate limiting (100 req/min/IP), verified live against production with a real burst test (`429` returned exactly at request 101)
- 16 AWS Config managed rules (S3 public-access/encryption, RDS encryption/public-access/Multi-AZ, IAM MFA/key-rotation, VPC security groups, Lambda public-access, CloudTrail/GuardDuty enabled) with NON_COMPLIANT transitions routed into the same alert pipeline as the CloudWatch alarms
- GuardDuty and AWS Config both confirmed enabled and recording (account baseline, not managed by this repo's CDK)
- A concurrency/load test (90 genuinely simultaneous authenticated requests, 0 errors) — not proof of scale, but proof the system doesn't fail under basic simultaneous use, which had never been tested before

## Known gaps this packet does not resolve

- No formal risk analysis (this document is preparation for one, not one itself)
- No workforce sanction policy or documented security-awareness training program
- Clinic-facing BAA and privacy policy not yet reviewed by counsel or executed
- No independent security review / penetration test has been performed — see `compliance/SECURITY-REVIEW-SCOPE.md`
