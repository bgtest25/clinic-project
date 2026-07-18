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

- Security pass: confirm every PHI-touching service is HIPAA-eligible, KMS encryption verified everywhere, least-privilege IAM audit
- S3 lifecycle rule to auto-delete raw audio after a configurable window post-sign-off
- Draft the BAA you'll sign with the pilot clinic (you're the business associate, they're the covered entity)
- Retention/deletion policy, privacy policy, lightweight incident-response runbook
- **Deliverable**: ready for a real clinic to put real patient data through this

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
