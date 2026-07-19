# Havenote — Data Retention & Deletion Policy

**Status:** describes system behavior as actually implemented, verified 2026-07-19. Not a
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
| Clinician/account data (Cognito, `users` table) | Cognito user pool + Postgres `users` table | Indefinite; deactivation (not deletion) on offboarding | `PATCH /users/:id/deactivate` (admin-only, own-clinic only) disables the Cognito user, signs out any active session, and sets `User.deactivatedAt` — the row itself is never deleted, since `ClinicalNote.signedById` and `AuditLog.actorId` depend on it for the legal/audit record. `PATCH /users/:id/reactivate` reverses it. |

## How deletion is verified

Every raw-audio purge (successful or failed) writes an `AuditLog` row (`audio.purged` /
`audio.purge_failed`) and sets `AudioRecording.deletedAt` — so "was this actually deleted, and when"
is a queryable fact, not something to trust blindly. Lifecycle-rule-driven deletions (the 90/30/365-day
backstops) are AWS-managed and not individually logged in the application's own audit trail; if that
level of granularity is ever required, CloudTrail's S3 data events would need to be enabled for this
bucket (currently only management events are captured account-wide).

## Minimum retention requirement (resolved 2026-07-19)

The pilot clinic is in **Pennsylvania**. Physician offices there must retain a patient's medical
record for **at least 7 years from the date of the last medical service**, and for a minor patient
**until 1 year after they reach the age of majority**, even if that exceeds 7 years (49 Pa. Code
§ 16.95). This is a floor, not a ceiling — nothing above describes an obligation to *delete* at any
point.

The system already satisfies this trivially: `clinical_notes` and `transcripts` are retained
**indefinitely** with no automated deletion (see the table above) — indefinite retention is always
≥ any finite statutory minimum. This is not a legal opinion; confirm against the specific pilot
clinic's status (hospital vs. physician office) and any applicable federal program requirements
(e.g. Medicare/Medicaid) before relying on it, consistent with this file's own status note above.

## Patient-initiated deletion/amendment requests (built 2026-07-19)

HIPAA (45 CFR § 164.526) gives patients a right to *request* amendment, not a right to erasure —
a covered entity may deny the request, and Pennsylvania's 7-year floor above means outright
deletion generally isn't a legally available option anyway. Accordingly, this is a
**log-and-route-for-review** flow, not a delete/anonymize action:

- `POST /patients/:id/data-requests` — any clinic staff member logs an incoming request
  (`requestType: 'deletion' | 'amendment'`, optional `reason`). Status starts `pending`.
- `GET /patients/:id/data-requests` — lists a patient's requests, clinic-scoped.
- `PATCH /patients/:id/data-requests/:requestId` — admin-only; resolves a request
  (`status: 'approved' | 'denied'`, optional `resolutionNote`).

No code path in this flow deletes or mutates `Patient` or clinical-record data. Every log/resolve
action also writes an `AuditLog` row (`patient.data_request_logged` /
`patient.data_request_resolved`).

## AWS Config bucket lifecycle (resolved 2026-07-19)

`config-bucket-501264525435` had no lifecycle rule (`NoSuchLifecycleConfiguration`) — config
history was accumulating unbounded. Applied a 365-day expiration rule directly via
`aws s3api put-bucket-lifecycle-configuration` (this bucket is account-baseline, not managed by
this repo's CDK), matching the existing CloudTrail bucket's retention above.
