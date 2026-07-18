# Havenote — Data Retention & Deletion Policy

**Status:** describes system behavior as actually implemented, verified 2026-07-18. Not a
legally-reviewed document — see the "Open items" section for gaps that need a decision before
the pilot, and reconcile the retention periods below against whatever minimum medical-record
retention period applies in the pilot clinic's state before relying on them.

## Purpose

Defines how long each category of data Havenote handles is kept, what triggers its deletion, and how
that deletion is verified. Data minimization (not keeping PHI longer than necessary) is a HIPAA
Security Rule expectation, not just good practice.

## Data inventory and retention

| Data | Where it lives | Retention | Deletion trigger |
|---|---|---|---|
| Raw visit audio | S3 `clinic-project-media-*`, `audio/` prefix | Until the visit's note is signed, or 90 days, whichever comes first | **Primary:** `NotesService.sign()` deletes the object the moment its note is signed (audio is no longer needed once the transcript + note exist). **Backstop:** a 90-day S3 lifecycle rule catches anything that never reaches signed (abandoned recordings, stuck/failed pipeline runs). |
| Raw Transcribe output (JSON) | S3 `clinic-project-media-*`, `transcripts/` prefix | 30 days | S3 lifecycle rule. This is a redundant intermediate — `process-transcript` copies the transcript text into the `transcripts` table, which is the source of truth from then on; nothing ever reads this S3 copy again. |
| Transcript text | Postgres `transcripts` table | Indefinite (no automated deletion) | None currently — part of the permanent clinical record. |
| Clinical notes (draft/signed/amended) | Postgres `clinical_notes` table | Indefinite, append-only | None — signed notes are locked; edits after signing create a new versioned row rather than mutating history. |
| Audit trail (who did what, when) | Postgres `audit_logs` table | Indefinite | None — an audit trail that can be casually deleted isn't one. |
| Database backups | RDS automated backups | 7 days | AWS-managed, per `backupRetention` in `database-stack.ts`. |
| CloudTrail logs | S3 `clinic-project-cloudtrail-*` | 365 days (bucket lifecycle rule) | Automatic expiration. |
| AWS Config history | S3 `config-bucket-*` | Not yet verified — check `aws s3api get-bucket-lifecycle-configuration --bucket config-bucket-501264525435` before relying on any assumption here. | — |
| Clinician/account data (Cognito, `users` table) | Cognito user pool + Postgres `users` table | Indefinite while the account is active | No offboarding/deletion flow exists yet — open item, see below. |

## How deletion is verified

Every raw-audio purge (successful or failed) writes an `AuditLog` row (`audio.purged` /
`audio.purge_failed`) and sets `AudioRecording.deletedAt` — so "was this actually deleted, and when"
is a queryable fact, not something to trust blindly. Lifecycle-rule-driven deletions (the 90/30/365-day
backstops) are AWS-managed and not individually logged in the application's own audit trail; if that
level of granularity is ever required, CloudTrail's S3 data events would need to be enabled for this
bucket (currently only management events are captured account-wide).

## Open items (not yet decided or built)

- **Minimum retention requirement**: this policy describes maximums/expirations, not a *minimum* required
  retention for clinical records. Many US states require clinical records be kept 7+ years (longer for
  minors) — nothing in the system currently enforces a floor, though nothing auto-deletes clinical notes
  either, so this is a "confirm it meets the requirement," not "fix a bug."
- **Patient-initiated deletion requests**: no flow exists for a patient (via the clinic) to request
  deletion/amendment beyond what HIPAA already requires the covered entity to support. Needs a decision
  before pilot.
- **Account offboarding**: no code path removes a clinician's data on account closure.
- **AWS Config bucket lifecycle**: unverified as of this writing — check before pilot.
