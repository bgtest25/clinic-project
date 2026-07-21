import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import { generateSoapNote } from './index';

jest.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: jest.fn().mockImplementation(() => ({ send: jest.fn() })),
  InvokeModelCommand: jest.fn().mockImplementation((input: unknown) => ({ input })),
}));

// `index.ts` instantiates BedrockRuntimeClient exactly once at module load —
// grab that single instance's `send` mock rather than referencing an
// outer-scope variable inside the jest.mock factory (which jest hoists above
// any such declaration, causing a "Cannot access before initialization").
const mockSend = jest.mocked(BedrockRuntimeClient).mock.results[0].value.send;

// Synthetic urgent-care transcripts used to validate the redesigned prompt's
// instructions make sense against realistic input shapes. These aren't run
// against live Bedrock here (that's blocked pending AWS account access) —
// they document the expected behavior so the same fixtures can be replayed
// against the real model the moment access clears, as the actual quality check.

const VIRAL_URI_TRANSCRIPT =
  'Clinician: What brings you in today? Patient: I\'ve had a cough and runny nose for three days, ' +
  'and my throat is a bit sore. No fever that I\'ve noticed. Clinician: Any shortness of breath or ' +
  'chest pain? Patient: No, nothing like that. Clinician: This sounds like a viral upper respiratory ' +
  'infection. I recommend rest, fluids, and over-the-counter symptom relief. Come back if you ' +
  'develop a fever over 101 or trouble breathing.';

const ANKLE_SPRAIN_TRANSCRIPT =
  'Clinician: Tell me what happened. Patient: I rolled my ankle playing basketball yesterday. ' +
  'Clinician: On exam, there is swelling and tenderness over the lateral malleolus, but she can ' +
  'bear weight and has good range of motion. No bony tenderness at the tip of the fibula. ' +
  'This looks like a grade one lateral ankle sprain, no imaging needed. Plan is RICE — rest, ice, ' +
  'compression, elevation — and an ankle brace, follow up in a week if not improving.';

const INCOMPLETE_TRANSCRIPT =
  'Patient: ...pain since [inaudible] ...maybe two days... Clinician: [crosstalk] okay let me just ' +
  '...[inaudible]... we\'ll go ahead and start you on something for that.';

function bedrockTextResponse(text: string) {
  return {
    body: new TextEncoder().encode(JSON.stringify({ content: [{ text }] })),
  };
}

describe('generateSoapNote', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    mockSend.mockReset();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns the fixed mock note and never calls Bedrock when MOCK_SOAP_NOTE=true', async () => {
    process.env.MOCK_SOAP_NOTE = 'true';

    const note = await generateSoapNote(VIRAL_URI_TRANSCRIPT);

    expect(note.subjective).toContain('[MOCK NOTE — Bedrock access pending]');
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('parses a normal Bedrock JSON response', async () => {
    process.env.MOCK_SOAP_NOTE = 'false';
    process.env.BEDROCK_MODEL_ID = 'anthropic.claude-sonnet-5';
    mockSend.mockResolvedValue(
      bedrockTextResponse(
        JSON.stringify({
          subjective: 'Cough, rhinorrhea, and mild sore throat for 3 days. No fever reported.',
          objective: '',
          assessment: 'Viral upper respiratory infection.',
          plan: 'Rest, fluids, OTC symptom relief. Return if fever >101F or dyspnea.',
          suggestedCodes: 'J06.9',
        }),
      ),
    );

    const note = await generateSoapNote(VIRAL_URI_TRANSCRIPT);

    expect(note.assessment).toBe('Viral upper respiratory infection.');
    expect(note.objective).toBe('');
    expect(note.suggestedCodes).toBe('J06.9');
  });

  it('parses a markdown-fenced Bedrock response', async () => {
    process.env.MOCK_SOAP_NOTE = 'false';
    const payload = JSON.stringify({
      subjective: 'Twisted ankle playing basketball yesterday.',
      objective: 'Swelling and tenderness over the lateral malleolus. Weight-bearing. Good ROM. No bony tenderness.',
      assessment: 'Grade 1 lateral ankle sprain.',
      plan: 'RICE, ankle brace, follow up in 1 week if not improving.',
      suggestedCodes: 'S93.401A',
    });
    mockSend.mockResolvedValue(bedrockTextResponse('```json\n' + payload + '\n```'));

    const note = await generateSoapNote(ANKLE_SPRAIN_TRANSCRIPT);

    expect(note.objective).toContain('lateral malleolus');
    expect(note.assessment).toBe('Grade 1 lateral ankle sprain.');
  });

  it('throws when the Bedrock response has no JSON object', async () => {
    process.env.MOCK_SOAP_NOTE = 'false';
    mockSend.mockResolvedValue(bedrockTextResponse('Sorry, I cannot help with that.'));

    await expect(generateSoapNote(INCOMPLETE_TRANSCRIPT)).rejects.toThrow('was not JSON');
  });

  it('sends the system prompt with field-specific anti-hallucination guidance', async () => {
    process.env.MOCK_SOAP_NOTE = 'false';
    mockSend.mockResolvedValue(
      bedrockTextResponse(
        JSON.stringify({ subjective: '', objective: '', assessment: '', plan: '', suggestedCodes: '' }),
      ),
    );

    await generateSoapNote(INCOMPLETE_TRANSCRIPT);

    const [command] = mockSend.mock.calls[0];
    expect(command.input.body).toContain('leave this empty rather than guessing');
    expect(command.input.body).toContain('do not paper over gaps by inventing');
  });
});
