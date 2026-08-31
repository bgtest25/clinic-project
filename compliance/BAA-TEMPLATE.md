# Business Associate Agreement — Template

**⚠️ NOT READY TO SIGN. This is a structural starting draft covering the required elements of a HIPAA
Business Associate Agreement under 45 CFR § 164.504(e), modeled on the required-provisions structure
published by HHS. It has not been reviewed by a healthcare attorney, does not account for the specific
clinic's state law, and must not be executed with a real clinic until qualified legal counsel has
reviewed and adapted it.** Placeholders are marked `[...]`.

---

This Business Associate Agreement ("Agreement") is entered into as of `[DATE]` between `[CLINIC LEGAL
NAME]` ("Covered Entity") and Havenote, Inc. ("Business Associate"), in connection with services
Business Associate provides to Covered Entity involving the creation, receipt, maintenance, or
transmission of Protected Health Information ("PHI") as defined by the Health Insurance Portability and
Accountability Act of 1996 and its implementing regulations, as amended ("HIPAA").

## 1. Definitions

Terms used but not otherwise defined in this Agreement have the meanings given in 45 CFR Parts 160 and
164 (the "Privacy Rule," "Security Rule," and "Breach Notification Rule").

## 2. Permitted uses and disclosures of PHI

Business Associate may use or disclose PHI only:
- as necessary to perform the services described in the underlying services agreement between the
  parties (`[reference the master services/subscription agreement]`);
- as required by law; and
- as otherwise permitted or required by this Agreement or by HIPAA.

Business Associate will not use or disclose PHI in any manner that would violate the Privacy Rule if
done by Covered Entity, except for Business Associate's own proper management, administration, and
legal responsibilities as permitted under 45 CFR § 164.504(e)(4).

## 3. Safeguards

Business Associate will implement administrative, physical, and technical safeguards that reasonably
and appropriately protect the confidentiality, integrity, and availability of electronic PHI, consistent
with the Security Rule (45 CFR Part 164, Subpart C). `[Reference Havenote's actual technical measures —
see RETENTION-POLICY.md and the CloudTrail/Config/GuardDuty baseline in ROADMAP.md — once counsel
confirms how specific this section should be.]`

## 4. Reporting obligations

Business Associate will report to Covered Entity, without unreasonable delay:
- any use or disclosure of PHI not permitted by this Agreement, of which it becomes aware; and
- any Breach of Unsecured PHI, as defined at 45 CFR § 164.402, without unreasonable delay and in no
  case later than `[X business days — recommend materially shorter than HIPAA's 60-day outer limit for
  covered entities, since Covered Entity needs runway within that window; see
  INCIDENT-RESPONSE-RUNBOOK.md]` after discovery, including the information Covered Entity needs to
  meet its own Breach Notification Rule obligations to affected individuals, HHS, and media as
  applicable.

## 5. Subcontractors

Business Associate will ensure that any subcontractor that creates, receives, maintains, or transmits
PHI on Business Associate's behalf agrees, in writing, to restrictions and conditions at least as
restrictive as those in this Agreement. `[List current subprocessors — AWS (hosting, storage, Amazon
Transcribe Medical, and as of 2026-08-31 the Claude model via Amazon Bedrock) — and confirm the
existing AWS BAA's effective scope explicitly covers Bedrock before this section is finalized; see the
Subprocessors section of PRIVACY-POLICY.md. Anthropic is not a separate subprocessor as of 2026-08-31 —
an earlier direct-API architecture (2026-08-14 through 2026-08-31) has since been replaced.]`

## 6. Access, amendment, and accounting of disclosures

Business Associate will make PHI available to Covered Entity as necessary for Covered Entity to fulfill
its obligations to provide individuals access to their PHI (45 CFR § 164.524), to incorporate
amendments (45 CFR § 164.526), and to provide an accounting of disclosures (45 CFR § 164.528).

## 7. Availability of records to HHS

Business Associate will make its internal practices, books, and records relating to the use and
disclosure of PHI available to the Secretary of HHS for purposes of determining Covered Entity's and
Business Associate's compliance with HIPAA.

## 8. Minimum necessary

Business Associate will limit its request, use, and disclosure of PHI to the minimum necessary to
accomplish the intended purpose, consistent with 45 CFR § 164.502(b).

## 9. Term and termination

This Agreement is effective as of the date above and terminates when the underlying services agreement
terminates, or immediately upon Covered Entity's determination that Business Associate has violated a
material term, subject to any cure period the parties agree to.

Upon termination, Business Associate will, at Covered Entity's election, return or destroy all PHI it
still maintains, in any form, and retain no copies — except where return or destruction is infeasible
(e.g., PHI embedded in backups not readily separable), in which case Business Associate will extend the
protections of this Agreement to that PHI for as long as it is maintained, and limit further uses and
disclosures to those purposes that make return or destruction infeasible.

## 10. Miscellaneous

`[Governing law, notices, entire agreement, amendment — standard boilerplate counsel will want to
tailor to the specific relationship and jurisdiction.]`

---

**Signatures**

`[CLINIC LEGAL NAME]` ("Covered Entity")

By: `[NAME]` — `[TITLE]` — `[DATE]`

Havenote, Inc. ("Business Associate")

By: `[NAME]` — `[TITLE]` — `[DATE]`
