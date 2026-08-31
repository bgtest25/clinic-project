# Havenote — Cover Memo for Legal Review

**Purpose:** orient counsel quickly before they read `BAA-TEMPLATE.md` and `PRIVACY-POLICY.md` in
full. Not a substitute for reading those documents — a map of what's settled, what's placeholder,
and what's needed from the client before review can really start.

## What Havenote is, in one paragraph

A clinical documentation SaaS. A clinician records a patient visit; the audio is transcribed; an
AI drafts a structured SOAP note from the transcript; the clinician reviews, edits, and signs it.
Havenote (the vendor) is a HIPAA **business associate**; each clinic that uses it is the
**covered entity**. No clinic has real patient data in the system yet — onboarding a real clinic
is explicitly blocked on this legal review completing.

## Documents in this review

- `compliance/BAA-TEMPLATE.md` — draft Business Associate Agreement between Havenote and a clinic
- `compliance/PRIVACY-POLICY.md` — Havenote's own privacy policy (distinct from a clinic's Notice
  of Privacy Practices, which each clinic owns separately — see the document's own opening section)
- `compliance/RETENTION-POLICY.md` — data retention periods, described as-built (this one is
  system-verified, not a legal opinion — flagged as high-confidence in the document itself)
- `compliance/INCIDENT-RESPONSE-RUNBOOK.md` — breach-notification timeline analysis and contacts

## What changed recently that the documents already reflect

The AI-drafting subprocessor has changed twice. It moved from a direct Anthropic API call back to
Amazon Bedrock on 2026-08-31, once the AWS account restriction that originally forced the
2026-08-14 workaround cleared. Both `BAA-TEMPLATE.md` §5 and `PRIVACY-POLICY.md`'s Subprocessors
section have been corrected again to reflect this (2026-08-31) — they now describe Bedrock, not a
direct Anthropic call. **Net effect: Anthropic is no longer a subprocessor of this system at all**,
and the AI-drafting data flow is covered by the existing AWS BAA rather than needing a separate
agreement. See `compliance/ANTHROPIC-DATA-FLOW-SUMMARY.md` (now superseded) for what the interim
direct-API architecture sent, and `compliance/SECURITY-REVIEW-SCOPE.md` for the current flow.

## What's still placeholder in these documents (marked `[...]` in the files themselves)

- Clinic legal name, address, execution date (BAA)
- Havenote's own signatory name/title
- The specific breach-notification timeline Havenote commits to in the BAA (currently a
  placeholder recommending "materially shorter than HIPAA's 60-day outer limit")
- Subprocessor BAA/agreement status: **AWS's is confirmed active** (see below) and, as of
  2026-08-31, covers the AI-drafting call too since it now goes through Bedrock. Anthropic is no
  longer a subprocessor of this system — there is nothing to confirm for it
- Governing law, standard boilerplate (BAA §10)
- Havenote's own privacy/legal contact information (privacy policy)
- Policy-update notice mechanism (privacy policy)

## What's needed from the client before these placeholders can be filled

1. The pilot clinic's actual legal name, address, and state of operation. (`RETENTION-POLICY.md`'s
   retention-period analysis is Pennsylvania-specific — if the actual pilot clinic isn't in PA,
   that analysis needs to be redone for the correct state.)
2. Confirmation that the AWS BAA's effective scope explicitly covers Bedrock (the AI-drafting
   subprocessor as of 2026-08-31) — expected but not yet independently re-confirmed post-switch.
   An Anthropic BAA is no longer needed; the 2026-08-17 outreach to Anthropic's commercial team
   can be dropped or left to lapse.
3. Havenote's own signatory information.

## Independent confirmation already done (not asserted, actually checked)

- AWS BAA: confirmed **active**, effective 2026-07-17, via `aws artifact list-customer-agreements`
  — not just assumed from the roadmap's task list.
- The retention policy's Pennsylvania analysis (49 Pa. Code § 16.95, ≥7 years from last visit) —
  the system's actual retention behavior (indefinite, no automated deletion of clinical notes or
  transcripts) satisfies this floor trivially, confirmed against the live schema.

## What this review is not expected to cover

- A HIPAA Security Risk Assessment — that's a separate, structured exercise. A technical evidence
  packet for it exists at `compliance/HIPAA-RISK-ASSESSMENT-EVIDENCE.md` if useful context, but
  it's not part of this legal review.
- An independent security/penetration test — not yet performed; scoped separately at
  `compliance/SECURITY-REVIEW-SCOPE.md`.
