import { Injectable } from '@nestjs/common';
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';

const PRIOR_AUTH_SYSTEM_PROMPT = `You are helping a clinician write a prior authorization request to an insurance company. The goal is to clearly document medical necessity so the insurer approves the requested procedure, test, or medication.

Format the clinical rationale as follows:
1. PATIENT INFORMATION — name, DOB, and diagnosis
2. REQUESTED SERVICE — the specific procedure, test, or medication being requested
3. CLINICAL INDICATION — why this service is medically necessary for this patient
4. SUPPORTING EVIDENCE — relevant symptoms, exam findings, failed treatments, and test results from the clinical note
5. TREATMENT HISTORY — what has already been tried (if applicable) and why alternatives are insufficient
6. EXPECTED BENEFIT — what outcome is expected from the requested service
7. URGENCY — whether this is routine, urgent, or emergent, with justification if urgent/emergent

Rules:
- Use clinical terminology appropriate for insurance medical reviewers
- Be thorough but concise — reviewers process many requests
- Cite specific findings from the note to support medical necessity
- Never invent information not in the source note
- If the note lacks information for a section, note "Not documented in visit note"
- Output plain text only, no markdown formatting`;

const REFERRAL_LETTER_SYSTEM_PROMPT = `You are helping a primary care physician draft a referral letter to a specialist. The letter should be professional, concise, and contain all information the specialist needs to evaluate and treat the patient.

Format the letter as follows:
1. Start with "Dear [Specialty] Colleagues," (e.g., "Dear Cardiology Colleagues,")
2. REASON FOR REFERRAL — 1-2 sentences stating why you're referring this patient
3. RELEVANT HISTORY — bullet points of pertinent medical history, medications, and allergies
4. CURRENT MEDICATIONS — list current medications with doses if known
5. RECENT FINDINGS — relevant exam findings, vitals, and any test results from this visit
6. CLINICAL QUESTION — specific question or request for the specialist
7. Close with "Thank you for seeing this patient." and the referring clinician's signature block

Rules:
- Be concise but complete — specialists are busy
- Include only clinically relevant information for the specialty
- Never invent information not in the source note
- Use professional medical terminology appropriate for physician-to-physician communication
- Output plain text only, no markdown formatting`;

const AVS_SYSTEM_PROMPT = `You are helping create a patient-friendly visit summary. The clinician has already reviewed and signed the clinical note — your job is to translate it into plain language the patient can understand and act on.

Write at a 6th-grade reading level. No medical jargon. Use "you" and "your" to address the patient directly.

The summary must include these sections in this exact order:
1. WHAT WE TALKED ABOUT — one sentence about why the patient came in
2. WHAT WE FOUND — simple description of any exam findings or test results, or "No concerning findings" if the exam was normal
3. YOUR DIAGNOSIS — the condition in plain terms, with a brief explanation if helpful
4. YOUR TREATMENT PLAN — numbered list of what the patient should do (medications with simple instructions, rest, follow-up, etc.)
5. WHEN TO CALL US — warning signs that should prompt a call or return visit
6. FOLLOW-UP — when to come back, or "No follow-up needed unless symptoms don't improve"

Rules:
- Never invent symptoms, findings, or instructions not in the original note
- If a medication was prescribed, include the name and simple dosing (e.g., "Take Amoxicillin 3 times a day for 10 days")
- Keep each section to 1-3 sentences max
- Do not include ICD-10 codes or technical terminology
- Output plain text only, no markdown formatting`;

interface AvsInput {
  patientName: string;
  visitDate: string;
  clinicName: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

interface ReferralLetterInput {
  patientName: string;
  patientDob: string;
  visitDate: string;
  clinicName: string;
  clinicianName: string;
  specialty: string;
  reason: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

interface PriorAuthInput {
  patientName: string;
  patientDob: string;
  visitDate: string;
  clinicName: string;
  clinicianName: string;
  procedureOrMed: string;
  diagnosisCode: string | null;
  insurerName: string | null;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

@Injectable()
export class AiService {
  private readonly bedrock = new BedrockRuntimeClient({});

  async generateAfterVisitSummary(input: AvsInput): Promise<string> {
    const noteContent = [
      `Patient: ${input.patientName}`,
      `Visit Date: ${input.visitDate}`,
      `Clinic: ${input.clinicName}`,
      '',
      'CLINICAL NOTE:',
      '',
      `Subjective: ${input.subjective || 'Not documented'}`,
      '',
      `Objective: ${input.objective || 'Not documented'}`,
      '',
      `Assessment: ${input.assessment || 'Not documented'}`,
      '',
      `Plan: ${input.plan || 'Not documented'}`,
    ].join('\n');

    const response = await this.bedrock.send(
      new ConverseCommand({
        modelId: process.env.BEDROCK_MODEL_ID || 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
        system: [{ text: AVS_SYSTEM_PROMPT }],
        inferenceConfig: { maxTokens: 1000 },
        messages: [
          {
            role: 'user',
            content: [{ text: `Please create a patient-friendly visit summary from this clinical note:\n\n${noteContent}` }],
          },
        ],
      }),
    );

    const content = response.output?.message?.content ?? [];
    const textBlock = content.find((b): b is { text: string } => typeof (b as any).text === 'string');
    if (!textBlock) throw new Error('No text content in Bedrock response');

    return textBlock.text;
  }

  async generateReferralLetter(input: ReferralLetterInput): Promise<string> {
    const noteContent = [
      `Patient: ${input.patientName}`,
      `DOB: ${input.patientDob}`,
      `Visit Date: ${input.visitDate}`,
      `Referring Clinic: ${input.clinicName}`,
      `Referring Clinician: ${input.clinicianName}`,
      '',
      `Specialty: ${input.specialty}`,
      `Reason for Referral: ${input.reason}`,
      '',
      'CLINICAL NOTE:',
      '',
      `Subjective: ${input.subjective || 'Not documented'}`,
      '',
      `Objective: ${input.objective || 'Not documented'}`,
      '',
      `Assessment: ${input.assessment || 'Not documented'}`,
      '',
      `Plan: ${input.plan || 'Not documented'}`,
    ].join('\n');

    const response = await this.bedrock.send(
      new ConverseCommand({
        modelId: process.env.BEDROCK_MODEL_ID || 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
        system: [{ text: REFERRAL_LETTER_SYSTEM_PROMPT }],
        inferenceConfig: { maxTokens: 1500 },
        messages: [
          {
            role: 'user',
            content: [{ text: `Please draft a referral letter to ${input.specialty} based on this clinical note:\n\n${noteContent}` }],
          },
        ],
      }),
    );

    const content = response.output?.message?.content ?? [];
    const textBlock = content.find((b): b is { text: string } => typeof (b as any).text === 'string');
    if (!textBlock) throw new Error('No text content in Bedrock response');

    return textBlock.text;
  }

  async generatePriorAuth(input: PriorAuthInput): Promise<string> {
    const noteContent = [
      `Patient: ${input.patientName}`,
      `DOB: ${input.patientDob}`,
      `Visit Date: ${input.visitDate}`,
      `Clinic: ${input.clinicName}`,
      `Clinician: ${input.clinicianName}`,
      '',
      `Requested Service: ${input.procedureOrMed}`,
      input.diagnosisCode ? `Diagnosis Code: ${input.diagnosisCode}` : '',
      input.insurerName ? `Insurance: ${input.insurerName}` : '',
      '',
      'CLINICAL NOTE:',
      '',
      `Subjective: ${input.subjective || 'Not documented'}`,
      '',
      `Objective: ${input.objective || 'Not documented'}`,
      '',
      `Assessment: ${input.assessment || 'Not documented'}`,
      '',
      `Plan: ${input.plan || 'Not documented'}`,
    ].filter(Boolean).join('\n');

    const response = await this.bedrock.send(
      new ConverseCommand({
        modelId: process.env.BEDROCK_MODEL_ID || 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
        system: [{ text: PRIOR_AUTH_SYSTEM_PROMPT }],
        inferenceConfig: { maxTokens: 2000 },
        messages: [
          {
            role: 'user',
            content: [{ text: `Please write a prior authorization clinical rationale for the following:\n\n${noteContent}` }],
          },
        ],
      }),
    );

    const content = response.output?.message?.content ?? [];
    const textBlock = content.find((b): b is { text: string } => typeof (b as any).text === 'string');
    if (!textBlock) throw new Error('No text content in Bedrock response');

    return textBlock.text;
  }
}
