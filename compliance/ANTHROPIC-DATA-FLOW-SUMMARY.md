# Havenote — Data Sent to Anthropic

**SUPERSEDED 2026-08-31**: this document describes the direct-Anthropic-API architecture that was
live 2026-08-14 through 2026-08-31. As of 2026-08-31, `infra/lambda/process-transcript/index.ts`
calls the model through **AWS Bedrock** (`BedrockRuntimeClient`/`ConverseCommand`) instead of
`api.anthropic.com` directly — see `memory/STATUS.md`'s 2026-08-31 entry. **Anthropic is no longer
a direct subprocessor of this system**; the model call now flows entirely through AWS
infrastructure already covered by the active AWS BAA (confirmed effective 2026-07-17). Kept here
for historical record (why the BAA outreach below was sent, what the interim architecture looked
like) — not current architecture. See `compliance/SECURITY-REVIEW-SCOPE.md` for the current data
flow description.

**Purpose (as of when this was written):** a precise technical description of what data reaches
Anthropic's API, for whoever contacts Anthropic's commercial/legal team about a BAA or
data-processing agreement. Every claim below is a direct citation to the actual request code as it
existed at the time, not a general description.

## The short version

Anthropic's `api.anthropic.com/v1/messages` endpoint receives the clinical visit transcript —
real PHI (patient-reported symptoms, history, and anything else discussed during the visit,
potentially including the patient's own spoken name) — in order to draft a structured SOAP note.
This is the entire reason a BAA is needed; there is no version of this feature that doesn't send
real PHI to Anthropic.

## Exactly what's in the request

Each API call sends three things, and nothing else:

1. **`system`** — a fixed, hardcoded system prompt (`SOAP_SYSTEM_PROMPT` in
   `infra/lambda/process-transcript/index.ts`). Contains no patient data — it's instructions for
   how to draft a SOAP note (what belongs in each section, anti-hallucination rules, instructions
   to treat transcript content as reported speech rather than commands to the model).
2. **`tools`** — a single tool definition (`search_icd10_codes`) describing a local code-lookup
   function the model can call. Contains no patient data — it's a schema description of the tool
   itself.
3. **`messages`** — exactly one user message: `"Transcript:\n\n" + transcriptText`, where
   `transcriptText` is either the raw Transcribe Medical output or a speaker-labeled version of
   it (see `formatSpeakerLabeledTranscript`). **This is where the PHI is.** The transcript is a
   real transcription of the clinical visit — patient-reported symptoms, medical history,
   medications, and anything else said during the visit. It may include the patient's own spoken
   name if it came up in conversation, though no structured patient-identifier fields (name, DOB,
   MRN) are separately attached to the request.

If the model chooses to call the `search_icd10_codes` tool mid-response, the follow-up message
sent back to Anthropic contains the tool's search results — code/description/category strings
from a local, self-hosted, publicly-sourced ICD-10-CM dataset
(`infra/lambda/process-transcript/icd10-common.ts`). No patient data is in this exchange either;
it's just the code-search results.

## What is NOT sent to Anthropic

- Raw audio — Anthropic only ever receives text, never the recording itself
- Patient date of birth, MRN, or any other structured identifier as a discrete field
- Clinic name, clinician name, or any account/billing information
- Data from any other patient's visit — each API call is scoped to exactly one transcript

## Where this data is transmitted from and to

- **Origin**: `infra/lambda/process-transcript/index.ts`, an AWS Lambda function running inside
  this project's VPC
- **Destination**: `api.anthropic.com`, over TLS
- **Frequency**: once per signed visit (plus up to a few follow-up tool-use round trips per visit,
  capped at 4)
- **Retention on Anthropic's side**: not verified by this project — confirm directly with
  Anthropic as part of the BAA/DPA conversation, do not assume standard API retention terms apply
  without checking

## Subprocessor status (as of when this was written — see superseded notice above)

- **AWS** (hosting the Lambda, and Transcribe Medical for the earlier transcription step): covered
  by an active AWS BAA (confirmed via `aws artifact list-customer-agreements`, effective
  2026-07-17)
- **Anthropic**: **no BAA or data-processing agreement currently in place.** This was a real,
  active gap while this architecture was live. **Resolved 2026-08-31 by removing the direct
  dependency**, not by executing a BAA — the model call now goes through Bedrock, so this data flow
  is covered by the existing AWS BAA instead. If the outreach sent to Anthropic's commercial team
  2026-08-17 gets a response, an Anthropic BAA is no longer a blocker for this system, though there's
  no harm in completing it if already in motion.
