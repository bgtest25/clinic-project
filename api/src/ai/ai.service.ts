import { Injectable } from '@nestjs/common';
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';

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
}
