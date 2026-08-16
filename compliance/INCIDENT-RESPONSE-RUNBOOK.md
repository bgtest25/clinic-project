# Havenote — Security Incident Response Runbook

**Status:** operational draft, not legally reviewed. The HIPAA Breach Notification Rule timelines cited
below were verified against current HHS guidance (2026-07-18) — [HHS.gov Breach Notification
Rule](https://www.hhs.gov/hipaa/for-professionals/breach-notification/index.html). Role/contact
fields filled in 2026-08-16 (see below) — the document itself still needs a pass with counsel
before the pilot, same as `BAA-TEMPLATE.md`/`PRIVACY-POLICY.md`.

## Roles

- **Security Officer**: Barseh Gbor (phone: 267-650-8475, email: barsehgbor@gmail.com) — makes
  containment/notification-scope decisions
- **Privacy Officer**: Barseh Gbor (phone: 267-650-8475, email: barsehgbor@gmail.com) — owns breach
  determination and notification content
- **On-call engineer**: Barseh Gbor (phone: 267-650-8475, email: barsehgbor@gmail.com) — first
  responder for detection alerts

One person currently holds all three roles — reasonable for the current team size, but there's no
backup coverage if this person is unreachable during an actual incident. Worth splitting out once
the team grows.

## 1. Detection sources

- **GuardDuty** findings (account `501264525435`, detector `dccfb6e0cce0e95ccd6703f83b57cd22`)
- **AWS Config** compliance/drift notifications (recorder `default`, now recording all resource types
  including IAM — see `ROADMAP.md`'s account-baseline section)
- **CloudTrail** (trail `clinic-project-trail`) — for after-the-fact investigation of what an
  already-detected incident actually did
- Application signals: an `Encounter` stuck in `FAILED` with an unexpected `processingError`, unusual
  `AuditLog` activity (e.g., a burst of `note.sign` or `audio.purge_failed` entries), unexpected Cognito
  sign-ins
- AWS Health Dashboard / AWS Support notifications
- Direct report (clinician, engineer, or third party)

## 2. Triage — first 30 minutes

1. Confirm the signal is real, not a false positive (check GuardDuty finding detail, correlate with
   CloudTrail events for the same principal/time window).
2. Determine scope: which systems, which data. Specifically — **does this involve or risk PHI**
   (patient names, audio, transcripts, clinical notes)? This determines whether the Breach Notification
   Rule timelines below apply at all.
3. Snapshot evidence before touching anything: relevant CloudTrail events, GuardDuty finding JSON,
   application logs (CloudWatch `/clinic-project/api`, `/clinic-project/ai-pipeline`,
   `/aws/lambda/clinic-project-process-transcript`), the `audit_logs` table rows for the affected
   encounter(s)/user(s).

## 3. Containment

Pick what's relevant to the actual incident — this is a menu, not a checklist to run top-to-bottom:

- **Compromised IAM credentials**: rotate/deactivate via IAM console or CLI immediately; check
  CloudTrail for what that principal did while compromised.
- **Compromised Cognito user**: disable the user (`aws cognito-idp admin-disable-user`), force a
  password reset, review their recent `AuditLog` activity.
- **Compromised database credentials**: rotate the Secrets Manager secret
  (`clinic-project/main/rds/master-credentials`) — this requires an ECS service redeploy to pick up the
  new value.
- **Suspicious network activity**: tighten the relevant security group (`DatabaseSecurityGroup`,
  `ProcessTranscriptSg`, or the ECS service's) to cut off the specific path, not a blanket lockdown that
  takes the app down unless the situation warrants it.
- **Data exfiltration via S3**: check the media bucket's access patterns; if the key or bucket itself is
  suspected compromised (not just a single IAM principal), that's a KMS key policy / bucket policy
  question, escalate rather than improvising.

## 4. Eradication & recovery

- Confirm the entry point is closed (rotated credential, patched permission, closed network path) before
  declaring contained.
- Restore any affected data from RDS automated backups (7-day retention) if integrity is in question.
- Redeploy affected services once the underlying cause is fixed, not just the symptom.

## 5. Is this a reportable HIPAA breach?

A breach is an impermissible use/disclosure of unsecured PHI that compromises its security or privacy,
unless a risk assessment shows a low probability of compromise (45 CFR § 164.402). Since Havenote is a
**business associate** (not the covered entity), its obligation is to notify the affected **clinic**
promptly — the clinic then owns notifying patients/HHS/media under its own compliance program. Havenote's
own BAA with each clinic should specify a contractual timeline for this notice (see
`BAA-TEMPLATE.md`); until that's signed, treat "as fast as possible, same business day if feasible" as the
working standard — the industry-standard 60-day clock (below) is the covered entity's outer limit, not a
target to approach.

For reference, the covered entity's (clinic's) own obligations once notified:

- **Affected individuals**: notify without unreasonable delay, no later than **60 days** after
  discovery.
- **HHS**: if the breach affects **500+ individuals**, notify HHS within the same 60 days. If it affects
  **fewer than 500**, it can be logged and reported to HHS annually, within 60 days of the end of the
  calendar year in which it was discovered.
- **Media**: required if the breach affects more than 500 residents of a single state/jurisdiction,
  same 60-day outer limit.

Havenote's job in this chain: give the clinic what it needs (what happened, what data, how many
patients, when discovered, what's being done) fast enough that the clinic can meet its own 60-day clock
comfortably — not race it.

## 6. Post-incident

- Written summary: timeline, root cause, what data was actually affected, what changed to prevent
  recurrence.
- Update this runbook if the incident revealed a gap in it.
- If a BAA is in effect with an affected clinic, follow whatever reporting procedure that specific
  agreement specifies — this runbook is Havenote's internal default, not a substitute for the executed
  contract's terms.
