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

The AI-drafting subprocessor changed from Amazon Bedrock to a direct Anthropic API call
(architecture change, 2026-08-14 — a workaround for a separate, unrelated AWS account
restriction). Both `BAA-TEMPLATE.md` §5 and `PRIVACY-POLICY.md`'s Subprocessors section have
already been corrected to describe this accurately (2026-08-15) — they no longer say "via Amazon
Bedrock." See `compliance/ANTHROPIC-DATA-FLOW-SUMMARY.md` for exactly what data this sends.

## What's still placeholder in these documents (marked `[...]` in the files themselves)

- Clinic legal name, address, execution date (BAA)
- Havenote's own signatory name/title
- The specific breach-notification timeline Havenote commits to in the BAA (currently a
  placeholder recommending "materially shorter than HIPAA's 60-day outer limit")
- Subprocessor BAA/agreement status is explicitly flagged as unconfirmed for both AWS and
  Anthropic in the document text — **AWS's is confirmed active** (see below); **Anthropic's is
  not yet in place**
- Governing law, standard boilerplate (BAA §10)
- Havenote's own privacy/legal contact information (privacy policy)
- Policy-update notice mechanism (privacy policy)

## What's needed from the client before these placeholders can be filled

1. The pilot clinic's actual legal name, address, and state of operation. (`RETENTION-POLICY.md`'s
   retention-period analysis is Pennsylvania-specific — if the actual pilot clinic isn't in PA,
   that analysis needs to be redone for the correct state.)
2. Confirmation of whether an Anthropic BAA/DPA will be pursued before or in parallel with this
   review — the current subprocessor list in the BAA is accurate as of today, but incomplete
   until that agreement exists.
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
