# Havenote — Build Roadmap

Rough total: 8–12 weeks solo, with Phase 2 as the most likely place to run long.

## Phase 0 — AWS Foundation & Account Setup (3–5 days)

- Dedicated AWS account for this project, root MFA locked down, scoped IAM deploy role (no root-account daily use)
- Sign the AWS BAA via AWS Artifact first — this gates everything else that will touch real PHI, no reason to wait
- VPC via AWS CDK (TypeScript, so infra code lives in the same language as the app) — public/private subnets, NAT gateway
- CloudTrail (account-wide trail to a dedicated log bucket), GuardDuty, AWS Config turned on
- Secrets Manager conventions established
- **Deliverable**: an account that could pass a basic security review before a single line of product code exists

## Phase 1 — Core Infra Skeleton (1 week)

- CDK stacks: RDS Postgres Multi-AZ + KMS key, S3 buckets (SSE-KMS + lifecycle rules) for audio/PDFs, Cognito user pool with clinician/admin groups, ECS cluster + Fargate service + ALB + ACM + Route53
- Prisma schema + migrations: Clinic, User, Patient, Encounter, AudioRecording, Transcript, ClinicalNote, AuditLog
- Basic NestJS API: health check, Cognito-authenticated routes, Clinic/Patient/Encounter CRUD
- GitHub Actions → ECR → ECS deploy pipeline
- **Deliverable**: an empty-but-real app, deployed, behind real auth, on real AWS infra

## Phase 2 — Recording → AI Pipeline (2–3 weeks, the long pole)

- Web recording UI (consent capture step first) wired to Cognito
- Presigned S3 upload for audio
- Step Functions state machine: S3 upload event → Transcribe Medical job → Lambda step builds the Bedrock prompt from the transcript → Bedrock InvokeModel (Claude) → parse SOAP JSON → write ClinicalNote → notify
- Heavy iteration on the Bedrock prompt against real/sample transcripts — budget the most time here, this is what decides whether the note actually reads like a real clinical note
- **Deliverable**: record a visit, get a usable draft SOAP note out the other end, traceable end-to-end through Step Functions

## Phase 3 — Review, Sign-off, Export (1–2 weeks)

- Review/edit UI: transcript beside editable SOAP fields
- Every edit → an AuditLog row (append-only)
- Sign action locks the note, records signer + timestamp; later changes become versioned amendments, never silent overwrites
- PDF export + copy-to-clipboard, encounter dashboard/list view
- **Deliverable**: the full loop, recording to a signed, exportable note

## Phase 4 — Compliance Hardening & Pilot Prep (1–2 weeks)

- Security pass: confirm every PHI-touching service is HIPAA-eligible, KMS encryption verified everywhere, least-privilege IAM audit — **done** (2026-07-18): media bucket switched to SSE-KMS with a customer-managed key; IAM audit found 5 justified wildcards, no hardcoded secrets
- S3 lifecycle rule to auto-delete raw audio after a configurable window post-sign-off — **done**: event-driven purge in `NotesService.sign()` + 90-day backstop lifecycle rule
- RDS Multi-AZ — **done** (2026-07-18), verified as an in-place conversion, no data loss
- Draft the BAA you'll sign with the pilot clinic (you're the business associate, they're the covered entity) — **draft written**, `compliance/BAA-TEMPLATE.md` — **not reviewed by counsel, not ready to sign**
- Retention/deletion policy, privacy policy, lightweight incident-response runbook — **drafts written**: `compliance/RETENTION-POLICY.md`, `compliance/PRIVACY-POLICY.md`, `compliance/INCIDENT-RESPONSE-RUNBOOK.md`. The retention policy accurately describes already-built system behavior (high confidence); the privacy policy and BAA are legal documents that **need qualified legal counsel review before use with a real clinic** — see each file's own status note.
- **Deliverable**: ready for a real clinic to put real patient data through this, **pending legal review of the BAA/privacy policy** and the open items listed in `compliance/RETENTION-POLICY.md`

## Phase 5 — Pilot

- Onboard one clinic, 1–2 clinicians; shadow real visits; tune Bedrock prompts on real feedback
- Track time-saved-per-note and clinician satisfaction — this becomes your case study for the next clinic, and eventually hospitals

## Account baseline status (verified 2026-07-18, not managed by this repo's CDK)

Phase 0's "CloudTrail, GuardDuty, AWS Config turned on" item is done, but was set up outside this
codebase (likely at account creation, 2026-07-16) rather than through CDK — there's no IaC record of it.
Attempted to bring it under `cdk import`; not possible, since none of `AWS::CloudTrail::Trail`,
`AWS::Config::ConfigurationRecorder`, `AWS::Config::DeliveryChannel`, or `AWS::GuardDuty::Detector`
support CloudFormation's import operation (confirmed against AWS's resource-import-support docs — these
are account/region-singleton service configs outside the Cloud Control API). Decision: document the
snapshot here rather than build custom-resource wrappers to manage them from CDK. This is a point-in-time
record, not living config — verify against the account directly (commands below) before relying on it.

- **CloudTrail**: trail `clinic-project-trail`, multi-region, log file validation on, → bucket
  `clinic-project-cloudtrail-501264525435` (SSE-S3, versioned, fully public-access-blocked). Not sending
  to CloudWatch Logs.
  Verify: `aws cloudtrail get-trail --name clinic-project-trail`
- **AWS Config**: recorder `default`, continuous recording, **`allSupported: true` /
  `includeGlobalResourceTypes: true`** — originally excluded `AWS::IAM::Policy/User/Role/Group` from
  recording (a real audit-trail gap for IAM changes); fixed via `put-configuration-recorder` on
  2026-07-18. Delivery channel `default` → bucket `config-bucket-501264525435`.
  Verify: `aws configservice describe-configuration-recorders` /
  `describe-configuration-recorder-status`
- **GuardDuty**: detector `dccfb6e0cce0e95ccd6703f83b57cd22` enabled, with an extensive feature set on
  (malware protection for EBS, RDS login events, Lambda network logs, EKS audit logs, S3/DNS/VPC flow
  monitoring) — this breadth is why it wasn't imported either; replicating every feature toggle exactly
  in CDK to avoid an accidental downgrade on next deploy wasn't judged worth the risk for an
  already-working baseline.
  Verify: `aws guardduty get-detector --detector-id dccfb6e0cce0e95ccd6703f83b57cd22`

All commands above need `--profile clinic-project --region us-east-1` (AWS account 501264525435).

## Media bucket encryption decision (2026-07-18)

Switched the media bucket (`clinic-project-media-*`) from SSE-S3 to SSE-KMS with a customer-managed key
(`MediaBucketKey` in `storage-stack.ts`). S3 is HIPAA-eligible either way, but SSE-KMS produces a
CloudTrail-logged audit trail of every key use — SSE-S3 gives none — which is the more defensible choice
now that CloudTrail/Config/GuardDuty are documented as part of this account's compliance baseline.

The original blocker (a cross-stack IAM cycle between StorageStack and ComputeStack/AiPipelineStack,
same shape as the RDS-secret cycle from Phase 1) was solved by leaving the key on CDK's default policy
(full account-root trust, never modified) and granting each consumer via a plain IAM statement on its
own role — never touching the key's own resource policy from another stack. See the comments in
`storage-stack.ts`, `compute-stack.ts`, and `ai-pipeline-stack.ts` for the exact pattern if this needs
replicating elsewhere.
