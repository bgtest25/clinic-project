# Havenote — HHS/ONC SRA Tool Cross-Check

**What this is:** a question-by-question mapping of the real HHS/ONC Security Risk Assessment (SRA)
Tool (downloaded directly from healthit.gov 2026-08-19, version 3.6.1, `SRA_Tool_3_6_1-Excel_Workbook.xlsx`
— 125 questions across 7 sections, confirmed by parsing the actual file, not assumed) against what's
already documented in `compliance/HIPAA-RISK-ASSESSMENT-EVIDENCE.md` and
`compliance/SECURITY-RISK-ASSESSMENT.md`.

**What this is not:** a completed instance of the SRA Tool itself. This is prep to make filling out
the real tool fast — download the Excel workbook (or Windows app) from
[healthit.gov/privacy-security/security-risk-assessment-tool](https://healthit.gov/privacy-security/security-risk-assessment-tool/)
and transcribe the answers below section by section. Every answer marked **Answer:** below is
backed by a specific citation; every question marked **Needs your input** is a genuine judgment
call, organizational-practice question, or a place where "team of one, no pilot clinic signed yet"
changes what the honest answer actually is — none of these were guessed.

**Team/organizational context that shapes many answers below** (confirmed facts, not assumptions):
current team size is one person (Barseh Gbor), holding every named role (Security Officer, Privacy
Officer, on-call engineer per `INCIDENT-RESPONSE-RUNBOOK.md`); no pilot clinic has been signed as of
this writing (corrected 2026-08-17, see `memory/STATUS.md`); the system is fully AWS-hosted with no
physical office/device holding ePHI outside of a developer workstation.

---

## Section 1 — SRA Basics (10 questions)

1. Has your practice completed an SRA before? — **Answer: Yes.** `compliance/SECURITY-RISK-ASSESSMENT.md`, completed and signed 2026-08-16.
2. Do you review and update your SRA? — **Answer: Yes.** Next scheduled review 2027-08-16 (annual), or sooner on material change to team size or subprocessor list — the 2026-08-31 switch to AWS Bedrock (removing Anthropic as a subprocessor) is exactly this kind of trigger and should prompt an earlier review.
3. How often? — **Answer:** Annually, or triggered by a material change (see above).
4. Do you include all systems containing/processing/transmitting ePHI? — **Answer: Yes.** Evidence packet covers the full stack: RDS, S3, Lambda/Step Functions, ECS, Cognito, and the AI drafting call (AWS Bedrock as of 2026-08-31, previously a direct Anthropic API call).
5. How do you verify your security measures comply with current HIPAA requirements? — **Needs your input.** Describes your own ongoing verification process/cadence beyond the point-in-time assessment already built.
6. What do you include in your SRA documentation? — **Answer:** Threat/vulnerability analysis, current controls (cited to code/live verification), likelihood/impact/risk ratings, sign-off block — matches `SECURITY-RISK-ASSESSMENT.md`'s structure.
7. Do you respond to threats/vulnerabilities identified? — **Answer: Partial.** Direct remediation already shipped from this assessment (rate limiting, RDS Multi-AZ, monitoring, a proven backup-restore drill) — but the 5 High-risk items still need a deliberate remediation decision each before this is closed out, not just filed away.
8. Do you identify specific personnel to respond to threats? — **Answer: Yes, but a single point of failure.** All three incident-response roles are the same one person — `INCIDENT-RESPONSE-RUNBOOK.md` already documents this explicitly as a gap (no backup coverage if that person is unreachable).
9. Do you communicate SRA results to personnel involved in response? — **Needs your input.** Trivial at team-of-one scale, but phrase honestly rather than mark N/A.
10. How? — **Needs your input**, follows from Q9.

## Section 2 — Security Program Documentation (8 questions)

1. Do you maintain documentation of policies/procedures re: risk assessment, risk management, information security? — **Answer: Yes.** `compliance/RETENTION-POLICY.md`, `INCIDENT-RESPONSE-RUNBOOK.md`, `SECURITY-RISK-ASSESSMENT.md`, `PRIVACY-POLICY.md` (draft), `BAA-TEMPLATE.md` (draft).
2. Do you review/update this documentation? — **Needs your input.** No formal review cadence exists separate from the annual SRA review — worth deciding explicitly rather than assuming.
3. How do you update it? — **Needs your input.**
4. Is the security officer involved in all policy/procedure updates? — **Answer: Yes**, trivially — the Security Officer is the same person doing all the work.
5. How does documentation compare to actual business practices? — **Needs your input** — genuine judgment call.
6. How long are these documents kept? — **Needs your input/decision.** No explicit retention policy has been set for the compliance docs themselves (distinct from `RETENTION-POLICY.md`, which covers patient data, not security documentation).
7. Is documentation available to those who need it? — **Answer: Yes**, trivially — lives in the git repository, only one person currently needs access.
8. How? — **Answer:** Git repository access.

## Section 3 — Security Official & Workforce Security (19 questions)

1. Who is responsible for developing/implementing security policies/procedures? — **Answer:** Barseh Gbor (founder/sole engineer), per `INCIDENT-RESPONSE-RUNBOOK.md`'s named roles.
2. Do you identify/document the security officer's role and responsibilities? — **Answer: Yes.** `INCIDENT-RESPONSE-RUNBOOK.md`, filled in 2026-08-16.
3. Is your security officer qualified for the position? — **Needs your input** — genuine self-assessment.
4-6. Do workforce members know who/how to contact the security officer, or an alternate if unavailable? — **Needs your input**, but note the real, already-documented gap: single point of contact, no backup coverage (`INCIDENT-RESPONSE-RUNBOOK.md`).
7. How are staff roles/job duties defined re: ePHI access? — **Needs your input to clarify scope.** The system enforces role-based access for *clinic users* (admin/clinician via Cognito groups) — but this question is likely asking about your own internal workforce, which doesn't yet exist beyond you.
8-19 (screening, formal training program, training-record retention, log-in monitoring procedures, malware-protection policy language, ongoing-awareness program, sanction policy) — **Answer: No / not yet, for all of these.** This is a real, already-documented gap, not a guess: the evidence packet states plainly "Security awareness and training — Not started — team size is currently one person" and "sanction policy — Not started." Malware protection and log-in monitoring exist as *technical* controls (see Section 4) but aren't written into a workforce training/policy document, because there's no workforce yet to train.

## Section 4 — Access Control, Encryption, Audit, Technical Safeguards (30 questions)

This section is where the built system answers strongly and confidently.

1-7. Manage/control personnel access to ePHI; authorization process; access scope; unique user identification — **Answer: Yes, all implemented.** `RolesGuard` reads verified JWT claims (not client-trusted data); every clinic-scoped service resolves the caller via `UsersService.findByCognitoSub` and scopes to `clinicId`; unique Cognito identity per user (`User.cognitoSub` 1:1); admin-invite/deactivate/reactivate/Reset-MFA flows are all audit-logged. A 2026-08-11 audit found and fixed a real cross-clinic data leak — the evidence packet cites this directly.
8-14. Encryption everywhere ePHI is stored/transmitted (disk, database, cloud services, transit) — **Answer: Yes, implemented, not just evaluated.** RDS storage encryption, S3 media bucket SSE-KMS with a customer-managed key, TLS on all connections including the database connection.
15-19. Review of security settings; monitoring/logging of system activity — **Answer: Yes.** 11 CloudWatch alarms (RDS/ALB/ECS/Lambda/Step Functions/application-error-logs), 16 AWS Config managed rules with NON_COMPLIANT alerts routed to the same pipeline, account-wide CloudTrail, application-level `AuditLog` table on every sensitive action.
20. Automatic logoff? — **Answer: Yes.** 15-minute idle timeout, made resilient to backgrounded mobile tabs (a real bug found and fixed 2026-08-16 — the original implementation could silently fail to fire).
21-23. User authentication / verifying users are who they claim — **Answer: Yes.** Cognito password + mandatory TOTP MFA; every API request re-verified server-side via `CognitoJwtVerifier` against Cognito's public keys.
24-27. Protect ePHI from unauthorized modification/destruction; protect in transit; record activity — **Answer: Yes.** Signed notes are locked; post-sign edits become versioned amendments, never silent overwrites; append-only audit log; TLS everywhere; CORS locked to the two real frontend origins.
28. Stay current on emerging threats (e.g. a cybersecurity listserv)? — **Answer: No, not a formal process.** A real, undecided gap — worth a deliberate yes/no rather than silence.
29-30. Process to identify/evaluate emerging technical vulnerabilities; response to scan findings — **Answer: No formal vulnerability-scanning program exists.** This is exactly the gap `compliance/SECURITY-REVIEW-SCOPE.md` was written for — an independent review/pen test hasn't happened yet (see the pre-production gate list).

## Section 5 — Physical Safeguards (23 questions)

Mostly not-directly-applicable, since there is no physical office or device that itself stores or
processes ePHI — everything runs on AWS-hosted infrastructure. Answer honestly as "inherited from
AWS" rather than leaving blank, since HIPAA still expects the question to be addressed.

1. Manage access to the facility housing information systems/ePHI? — **Answer: Inherited from AWS.** All infrastructure is AWS-hosted (ECS Fargate, RDS, S3, Lambda); physical security is AWS's responsibility under the shared-responsibility model, covered by the active AWS BAA (confirmed via `aws artifact list-customer-agreements`, effective 2026-07-17).
2-7. Physical protections for devices/equipment, device inventory, cable locks, visitor access — **Needs your input** for your own developer workstation's physical security practices — the app itself holds no ePHI on any local device.
8-13. Access validation/authorization for facilities and critical systems, third-party facility access — **Answer, reframed:** this maps to AWS IAM practices rather than a physical facility. Least-privilege IAM reviewed 2026-07-18 (5 justified wildcards found, no hardcoded secrets).
14-15. Recording/examining system activity; audit-report retention — **Answer: Yes.** CloudTrail (account-wide, 365-day lifecycle rule fixed 2026-08-11), AWS Config, CloudWatch.
16. Records of physical changes to the facility — **Answer: N/A.** Infrastructure changes are tracked via CDK/CloudFormation and git history instead of a physical facility log.
17-19. Movement of devices, backups when devices move, sanitization on disposal — **Needs your input** for personal-device practices; not applicable to the cloud-only architecture itself.
20. Appropriate-use policy for devices — **Answer: No, not formally documented.** Real, undecided gap.
21. Access terminated when employment ends? — **Answer: Yes, the mechanism exists** (`PATCH /users/:id/deactivate` + `AdminUserGlobalSignOut`), though never yet exercised for an actual termination at team-of-one scale.
22. Procedures for terminating third-party access when a contract/BAA ends? — **Answer: No, not formally documented.** Real gap.
23. Media sanitization prior to re-use — **Answer: N/A.** No reused media/devices in this cloud-only architecture.

## Section 6 — Business Associates (15 questions)

1. Contract with business associates/third-party vendors? — **Answer: Yes.** AWS (covers the AI drafting call too, as of 2026-08-31 — see below), Zoho Mail, GitHub. Anthropic is no longer a direct business associate of this system.
2. Do vendors access your info systems/ePHI? — **Answer: Yes, for AWS.** The AI drafting call (transcript/SOAP-note text) now goes through AWS Bedrock rather than Anthropic's API directly — see `compliance/ANTHROPIC-DATA-FLOW-SUMMARY.md` for the now-superseded direct-API architecture and the data scope, unchanged in substance.
3. How do you identify which vendors are business associates? — **Answer:** Any vendor that creates, receives, maintains, or transmits ePHI on the practice's behalf — AWS qualifies; Zoho (business email) and GitHub (code hosting) do not, since neither ever touches ePHI.
4-5, 7. Enforcement/monitoring of BA access; awareness of BA security practices — **Needs your input.** No formal ongoing vendor-monitoring cadence has been established yet.
6. Executed BAAs with all business associates that touch ePHI? — **Answer: Yes, as of 2026-08-31.** AWS: active (confirmed via AWS Artifact), covers the full stack including the AI drafting call. Anthropic is no longer a business associate of this system — the AI pipeline was switched from a direct Anthropic API call to AWS Bedrock 2026-08-31, so no separate agreement is needed (see `compliance/ANTHROPIC-DATA-FLOW-SUMMARY.md`, now superseded, for the prior architecture and the outreach sent 2026-08-17 that this change made moot).
8. Satisfactory-assurances language in BAAs? — **Answer:** AWS's own standard BAA terms apply (not separately customized), and now cover the AI drafting data flow too since it moved to Bedrock.
9-15. Subcontractor terms, 2013 Omnibus Rule updates, vendor-compliance tracking — **Needs your input** / mostly not yet formally tracked. AWS maintains its own compliance program independently; no other subprocessor touches ePHI as of 2026-08-31.

## Section 7 — Contingency Planning (20 questions)

1-2. Contingency plan exists / documented? — **Answer: Yes.** `compliance/INCIDENT-RESPONSE-RUNBOOK.md` — still needs a legal pass, same status as the BAA/privacy-policy drafts.
3-4. Periodically updated / kept effective? — **Needs your input/decision.** No separate review cadence stated beyond the annual SRA review.
5-7. Emergency types considered and documented — **Partial answer.** The runbook covers detection/triage/containment/breach-notification; infrastructure-failure scenarios are well covered by RDS Multi-AZ and the proven backup-restore drill, but a broader enumeration (natural disaster, extended outage, etc.) isn't explicitly written out — **needs your input** for full coverage.
8-9. Policies to prevent/detect/respond to security incidents — **Answer: Yes.** `INCIDENT-RESPONSE-RUNBOOK.md` plus the CloudWatch/Config/GuardDuty alerting pipeline (10 alarms, confirmed delivering to a real, confirmed email subscription as of 2026-08-16).
10-11. Incident response team identified/trained — **Answer: Yes, but a single point of failure**, same caveat as Section 1 Q8 and Section 3 Q4-6.
12-14. Systems/ePHI necessary for business continuity; maintaining access/security during an emergency — **Answer:** RDS Multi-AZ (automatic failover) plus a proven point-in-time restore (2026-08-16 drill: restored instance's row counts matched the live primary exactly, not assumed).
15. Plan for backing up/restoring critical data? — **Answer: Yes, and proven, not just configured** — same real restore drill.
16-18. Emergency-procedure activation/coordination/termination steps — **Needs your input.** Not written as a formal step-by-step activation procedure beyond the runbook's containment section.
19-20. Formally evaluate the effectiveness of security safeguards? — **Answer: No, informal only.** Real, already-documented gap: multiple live security audits this project (2026-08-11, 08-15, 08-16) found and fixed real issues, but there's no *scheduled, formal* evaluation cadence — the evidence packet says this plainly rather than overclaiming.

---

## Real progress: 88/125 questions already answered (2026-08-31, three rounds)

`compliance/SRA-Tool-v3.6.1-Partial.xlsx` in this same directory is the actual downloaded tool
(v3.6.1, healthit.gov), with 88 of the 125 questions genuinely checked off — not a mockup. Built by
parsing the real workbook (`xlsx` npm package, in a throwaway scratch install, not a project
dependency) rather than guessing its layout, then mechanically placing a `✔` in column C of the
matching answer row.

**Round 1 (55 questions)**: only where the translation from this doc's cited answer to the tool's
exact wording was low-risk — a plain Yes/No/IDK question, or a multi-choice question where one
option is an unambiguous factual match. Deliberately skipped anything requiring a maturity/
formality judgment call (e.g. whether existing documentation counts as a fully "formal process"
versus "some documentation, not all complete"), even where this document gave a confident prose
answer, since translating that into the tool's specific worded options would mean making that
judgment on your behalf rather than just transcribing a fact.

**Round 2 (24 more), at your explicit request to continue**: answered the remaining questions
where the honest answer follows directly from an already-established fact — a prior "No" answer to
a closely related question in the same section (e.g. "we don't communicate SRA results to staff"
follows from "no formal communication process exists" for a team of one), or a real, cited project
fact not previously connected to that specific tool question (e.g. RDS/S3 as the "centrally stored"
backup answer for device-independent ePHI access). Section 1 is now fully answered (10/10). Still
deliberately skipped: anything about a physical facility that doesn't exist for this cloud-only
architecture, personal workstation/device practices only you would know, or genuine unresolved
policy questions (vendor BAA-clause specifics not independently verified, workforce-hiring
questions that don't structurally fit a team of one) — these remain in the "still unanswered"
list below, same as always.

**Round 3 (9 more), from real answers you gave when directly asked**: rather than continue guessing
at questions no established fact could settle, asked you a small number of consolidated questions
covering the underlying facts behind many of the remaining tool questions at once — disk encryption
on your dev workstation (yes), device-disposal practice (wipe + a certified third-party destruction
service with certificates), workspace privacy (private home office), device inventory (none kept),
whether the 2026-08-16 backup drill has been repeated (not yet, one-time only), and which emergency
types have actually been considered (cyberattack + infrastructure only, not comprehensively).
Mapped each real answer to its matching tool question, staying conservative where a periodic-
testing claim would have overstated a one-time drill as an established cadence (Section 7 Q14/15
deliberately picked the option that doesn't claim periodic testing, since only one real drill has
happened). **Also found a hard technical limit while researching**: AWS's actual BAA text is
confidential under the AWS Artifact NDA (confirmed via `aws artifact list-customer-agreements`) —
Section 6's remaining BAA-clause-specific questions (Q5, 9, 11, 13, 14, 15) genuinely cannot be
answered by reading the document myself; only you can, by opening AWS Artifact directly.

**Verified before treating any round as done**: independently re-read the written file after each
round and confirmed every checkmark landed on the exact intended row (not just that the script
exited cleanly), and confirmed no question ended up with two conflicting answers checked at once.
Round 1's re-read caught a real problem: the original downloaded template ships with 2 pre-existing
example checkmarks (Section 1, an internal sample answer) — found by an unexpected count mismatch,
cleared before applying ours. Confirmed the workbook's internal scoring formulas (`Risk_Logic`
sheet) are byte-for-byte intact after every write, not just that the file opens.

**Two real findings surfaced while doing this, worth flagging directly** (not silently corrected
in the cells above, since they contradict this document's own earlier prose):
- **Section 4 Q29** (vulnerability scanning): this document's Section 4 answer above says "No
  formal vulnerability-scanning program exists" — but AWS Inspector was enabled 2026-08-19 (ECR +
  Lambda scanning, confirmed live) and does run automated, continuous vulnerability scans.
  Round 1 left this unchecked pending exactly this judgment call; **round 2 answered it "Yes"**
  (periodic, scheduled scans), on the reasoning that Inspector's continuous automated scanning
  genuinely satisfies the question as worded — flagged here so you can override it if you disagree
  with that call, not asserted as beyond question.
- **Section 5 Q15** (audit-report retention ≥6 years): CloudTrail's actual retention is a 365-day
  lifecycle rule — under a year, not the ≥6 years this question asks about — even though Section
  4's broader "Yes, monitoring/logging implemented" answer is accurate on its own terms. Still left
  unchecked in round 2 too — this is a genuine compliance gap, not a translation judgment call, and
  picking either the compliant or non-compliant option without your input would misrepresent it.

**A structural category worth naming separately**: 8 of the 37 remaining questions (Section 2 Q8;
Section 3 Q5, 6, 7, 9, 12, 17, 19) ask about workforce processes — screening, training records,
role documentation, sanction-policy contents — that don't apply given a confirmed team of one (you
directly confirmed this 2026-08-31). These aren't compliance gaps and aren't really "needs your
input" either; the tool simply has no clean "not applicable, no additional workforce" option among
its choices, and forcing a "No" would misleadingly read as a real gap rather than a structural
non-issue. Left unchecked rather than picked either way — worth deciding for yourself how you want
to represent this in the actual tool (some versions let you write a free-text note per question).

## What to actually do with this

1. Open `compliance/SRA-Tool-v3.6.1-Partial.xlsx` directly (Excel or the free SRA Tool Windows app)
   — the 88 auto-filled answers are already there; spot-check a few against the cited sources
   above rather than trusting them blindly, and double-check the Section 4 Q29 call specifically.
2. Work through the remaining 37 questions using the prose answers above as a starting point
   where given, and your own honest judgment for everything marked "Needs your input" or left
   unchecked above — including "no" or "not yet" where that's the truth. The tool is designed to
   surface gaps, not to be gamed into a clean scorecard.
3. Once complete, update `compliance/SECURITY-RISK-ASSESSMENT.md`'s sign-off block: change
   "Reviewed alongside: HHS/ONC Security Risk Assessment Tool — ☐ yes ☑ no" to reflect that it's
   now been run.
