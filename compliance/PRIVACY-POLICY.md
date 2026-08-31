# Havenote — Privacy Policy (Draft)

**Status:** draft for review by qualified legal counsel before publication or use with a real clinic.
Not legal advice. Placeholders (`[...]`) need to be filled in with real company/contact details.

## Important distinction — read this before editing

This document describes how **Havenote, Inc.** (a technology vendor) handles data as a **HIPAA business
associate**. It is *not* a substitute for a covered entity's Notice of Privacy Practices (NPP).

Each clinic using Havenote is the **covered entity** and remains responsible for its own patient-facing
Notice of Privacy Practices under HIPAA — that document governs the clinic's own use of patient PHI and
patients' rights against the clinic. This policy covers Havenote's own handling of data it processes on
a clinic's behalf (governed by the Business Associate Agreement between Havenote and that clinic, see
`BAA-TEMPLATE.md`) and, separately, data Havenote collects directly from its own customers (the clinics
and clinicians who use the product).

## What Havenote collects

**From clinics and clinicians (Havenote's direct customers):**
- Account information: name, email, clinic affiliation, role (clinician/admin)
- Authentication data via AWS Cognito (password hash, MFA enrollment — Havenote never sees plaintext
  passwords)

**Processed on behalf of clinics, as their business associate (this is PHI, not Havenote's own data):**
- Patient name and date of birth
- Audio recordings of clinical visits, made only after the clinician confirms patient consent was
  obtained
- Transcripts and AI-drafted/clinician-edited clinical notes derived from those recordings
- An audit trail of who viewed, edited, or signed each note

## Why this data is collected

Solely to provide the clinical documentation service: transcribing visit audio, drafting a structured
note for clinician review, and maintaining a signed, exportable clinical record. Havenote does not use
patient data for advertising, does not sell it, and does not use it to train models beyond what its AI
subprocessor's own terms permit (see "Subprocessors" below — get this confirmed and cited specifically
before publishing).

## Who can access this data

- The treating clinician and authorized staff at the patient's own clinic
- Havenote engineering staff, only as needed to operate/support the system, under the confidentiality
  obligations in the BAA
- Named subprocessors below, strictly as needed to provide the service

## Subprocessors

Havenote uses the following subprocessors to provide the service. `[Confirm each one's HIPAA BAA status
with legal/procurement before publishing — do not assume it's in place just because the service is
"HIPAA-eligible."]`

- **Amazon Web Services** — hosting, storage (S3, RDS), transcription (Amazon Transcribe Medical),
  and (as of 2026-08-31) the Claude model used to draft clinical notes from transcripts, via Amazon
  Bedrock. AWS offers a BAA for HIPAA-eligible services, confirmed active
  (`aws artifact list-customer-agreements`, effective 2026-07-17), which covers Bedrock along with
  the rest of the stack. `[Reconfirm this BAA's effective scope explicitly includes Bedrock before
  publishing — do not assume from the service being "HIPAA-eligible" alone.]`

Anthropic is not a separate subprocessor of this system: from 2026-08-14 to 2026-08-31, the AI
drafting call went directly to Anthropic's own API as an interim workaround, but that path has
since been replaced with the Bedrock call above.

## Security measures

- Encryption at rest: AWS KMS (customer-managed key) for stored audio and derived artifacts; database
  storage encryption via a customer-managed KMS key
- Encryption in transit: TLS for all connections, including the application database connection
- Access control: Cognito authentication with MFA, role-scoped API access
- Audit logging: CloudTrail (account-wide), AWS Config (configuration change history), and an
  application-level audit trail of every clinical note edit, sign, and amendment
- Data minimization: raw audio recordings are deleted once no longer needed (see `RETENTION-POLICY.md`)

## Data retention

See `RETENTION-POLICY.md` for the specific retention period for each data category.

## Your rights

Patients: your rights regarding your own health information (access, amendment, accounting of
disclosures, requesting restrictions) are held against **your clinic**, not Havenote directly — contact
your clinic's Privacy Officer. Havenote supports the clinic in fulfilling these requests as required by
the Business Associate Agreement between Havenote and the clinic.

Clinicians/clinic staff (Havenote's direct customers): contact `[SUPPORT EMAIL]` to access, correct, or
request deletion of your own account information.

## Changes to this policy

`[Standard "we may update this policy and will notify you of material changes" language — have counsel
confirm the specific notice mechanism/timeline before publishing.]`

## Contact

`[Havenote legal/privacy contact — name, email, mailing address]`
