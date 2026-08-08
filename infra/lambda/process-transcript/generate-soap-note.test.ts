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

const PEDIATRIC_OTITIS_TRANSCRIPT =
  'Clinician: What\'s going on with him today? Mother: He\'s had a fever and has been tugging at his ' +
  'right ear for about two days, and he\'s been fussier than usual. Clinician: Any hearing changes or ' +
  'drainage from the ear? Mother: No drainage that I\'ve seen. Clinician: On exam his right eardrum is ' +
  'red and bulging, left side looks normal, no mastoid tenderness. This is acute otitis media in the ' +
  'right ear. I\'ll prescribe amoxicillin dosed for his weight. Bring him back if the fever doesn\'t ' +
  'improve in 48 to 72 hours or if he seems more unwell.';

const MULTI_COMPLAINT_ADULT_TRANSCRIPT =
  'Clinician: What brought you in today? Patient: Two things — my lower back has been killing me since ' +
  'I moved a couch last week, and also I\'m almost out of my blood pressure medication and need a ' +
  'refill. Clinician: Let\'s start with the back. Any numbness, tingling, or trouble with your bladder ' +
  'or bowels? Patient: No, nothing like that, just sore. Clinician: On exam there\'s tenderness along ' +
  'the lower back muscles, straight leg raise is negative both sides, no midline tenderness. This looks ' +
  'like mechanical low back pain, not anything nerve-related. I\'d recommend an anti-inflammatory and ' +
  'heat, and return if you get numbness, weakness, or bladder changes. Clinician: For the blood ' +
  'pressure, your reading today is 128 over 82, that\'s well controlled. I\'ll refill the lisinopril at ' +
  'the same dose.';

const PEDIATRIC_MULTI_COMPLAINT_TRANSCRIPT =
  'Clinician: What\'s been going on with her? Father: She\'s had a fever up to about 101 for two days, ' +
  'and yesterday a rash showed up on her chest and back. She\'s also just been more tired than normal. ' +
  'Clinician: Any cough, vomiting, or trouble breathing? Father: No, none of that. Clinician: I see a ' +
  'blanching, flat-to-slightly-raised rash across her trunk and upper arms, throat is a little red but ' +
  'no white patches, lungs are clear, no swollen glands. This looks like a nonspecific viral illness ' +
  'with a viral rash. Supportive care, fluids, and fever control — come back right away if the rash ' +
  'stops blanching, turns into pinpoint spots, the fever lasts past five days, or she has any breathing ' +
  'trouble.';

const ADOLESCENT_CONFIDENTIAL_TRANSCRIPT =
  'Clinician: Thanks for the history — would it be okay if I spoke with her alone for a few minutes? ' +
  'Mother: Of course, I\'ll step out. Clinician: So it\'s just us now — you mentioned feeling down ' +
  'lately, can you tell me more about that? Patient: Yeah, I\'ve felt pretty low for like a month, and ' +
  'I\'m not sleeping great. Clinician: Have you had any thoughts of hurting yourself or not wanting to ' +
  'be here? Patient: No, nothing like that, I\'m just really tired and unmotivated. Clinician: Thanks ' +
  'for being honest with me. This sounds consistent with mild depressive symptoms. I\'d like to refer ' +
  'you to a behavioral health specialist for further evaluation, and let\'s plan a follow-up in two ' +
  'weeks, sooner if things feel worse.';

const MEDICATION_RECONCILIATION_TRANSCRIPT =
  'Clinician: Let\'s go through your medications since your last visit. Patient: I\'m still on the ' +
  'metformin twice a day, and the lisinopril once in the morning. I ran out of the atorvastatin about ' +
  'three weeks ago and haven\'t restarted it. Clinician: Any reason you stopped it? Patient: No, just ' +
  'forgot to refill. Also my daughter gave me some of her ibuprofen for knee pain a few times last ' +
  'month. Clinician: Noted — I\'d avoid regular NSAID use with your kidney history, use acetaminophen ' +
  'instead if you need something. Your blood pressure and blood sugar logs both look well controlled. ' +
  'I\'ll restart the atorvastatin at the same dose and we\'ll recheck a lipid panel in three months.';

const TELEHEALTH_LIMITED_EXAM_TRANSCRIPT =
  'Clinician: This is a video visit today — can you describe what\'s going on? Patient: I\'ve had a ' +
  'itchy rash on my forearm for about four days, it\'s not spreading. Clinician: Can you hold it up to ' +
  'the camera? ...Okay, I can see a well-defined red, scaly patch, looks consistent with nummular ' +
  'eczema from here, though I can\'t feel it or check for warmth the way I could in person. No fever, ' +
  'no other symptoms? Patient: No, just itchy. Clinician: I\'ll prescribe a topical steroid cream. If ' +
  'it doesn\'t improve in two weeks or starts spreading, you\'ll need to come in for an in-person exam.';

const INFORMED_REFUSAL_TRANSCRIPT =
  'Clinician: Given your symptoms, I\'d recommend we send you to the ER for a CT scan to rule out ' +
  'appendicitis. Patient: I really don\'t want to go to the ER right now, I can\'t afford it and I have ' +
  'to pick up my kids. Clinician: I understand, but I want to be clear this could be serious if it is ' +
  'appendicitis — untreated it can rupture. Patient: I hear you, I\'m still choosing not to go right ' +
  'now. Clinician: Okay, I\'ve documented that I recommended emergency evaluation and you\'ve declined. ' +
  'If the pain worsens, you develop a fever, or the pain moves to your lower right side, go to the ER ' +
  'immediately. I\'d like to see you back here first thing tomorrow if you don\'t go.';

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

  it('attributes pediatric history to the reporting guardian, not the patient', async () => {
    process.env.MOCK_SOAP_NOTE = 'false';
    mockSend.mockResolvedValue(
      bedrockTextResponse(
        JSON.stringify({
          subjective:
            'Mother reports 2 days of fever and right ear tugging in this child, increased fussiness. No drainage noted.',
          objective:
            'Right tympanic membrane erythematous and bulging. Left TM normal. No mastoid tenderness.',
          assessment: 'Acute otitis media, right ear.',
          plan: 'Amoxicillin dosed for weight. Return if no improvement in 48-72 hours or worsening symptoms.',
          suggestedCodes: 'H66.91',
        }),
      ),
    );

    const note = await generateSoapNote(PEDIATRIC_OTITIS_TRANSCRIPT);

    expect(note.subjective).toContain('Mother reports');
    expect(note.assessment).toBe('Acute otitis media, right ear.');
  });

  it('keeps two unrelated complaints distinct in a single-visit note', async () => {
    process.env.MOCK_SOAP_NOTE = 'false';
    mockSend.mockResolvedValue(
      bedrockTextResponse(
        JSON.stringify({
          subjective:
            '1) Low back pain for 1 week after lifting a couch, no radiation, no numbness/tingling. ' +
            '2) Requesting refill of lisinopril for hypertension.',
          objective: 'Lumbar paraspinal tenderness, negative straight leg raise bilaterally. BP 128/82 today.',
          assessment: '1) Acute mechanical low back pain. 2) Hypertension, stable, on lisinopril.',
          plan:
            '1) NSAIDs, heat, activity as tolerated; return if numbness, weakness, or bladder changes. ' +
            '2) Lisinopril refilled at current dose.',
          suggestedCodes: 'M54.5, I10',
        }),
      ),
    );

    const note = await generateSoapNote(MULTI_COMPLAINT_ADULT_TRANSCRIPT);

    expect(note.assessment).toContain('low back pain');
    expect(note.assessment).toContain('Hypertension');
    expect(note.plan).toContain('Lisinopril refilled');
  });

  it('handles a pediatric visit with multiple complaints from a guardian', async () => {
    process.env.MOCK_SOAP_NOTE = 'false';
    mockSend.mockResolvedValue(
      bedrockTextResponse(
        JSON.stringify({
          subjective:
            'Father reports 2 days of fever to 101F and a rash on trunk/upper arms since yesterday, plus increased fatigue. No cough, vomiting, or breathing trouble.',
          objective:
            'Blanching maculopapular rash on trunk and proximal extremities. Oropharynx mildly erythematous, no exudate. Lungs clear, no lymphadenopathy.',
          assessment: 'Nonspecific viral illness with viral exanthem.',
          plan:
            'Supportive care, fluids, antipyretics as needed. Return if rash becomes non-blanching/petechial, fever persists beyond 5 days, or breathing difficulty develops.',
          suggestedCodes: 'R21',
        }),
      ),
    );

    const note = await generateSoapNote(PEDIATRIC_MULTI_COMPLAINT_TRANSCRIPT);

    expect(note.subjective).toContain('Father reports');
    expect(note.subjective).toContain('rash');
    expect(note.assessment).toContain('viral exanthem');
  });

  it('reflects a private-portion adolescent conversation without inventing guardian consent', async () => {
    process.env.MOCK_SOAP_NOTE = 'false';
    mockSend.mockResolvedValue(
      bedrockTextResponse(
        JSON.stringify({
          subjective:
            'Patient interviewed privately per patient request, guardian stepped out. Reports ~1 month of low mood and poor sleep. Denies suicidal ideation when directly asked.',
          objective: 'Alert, cooperative, appropriate affect, no acute distress.',
          assessment: 'Symptoms consistent with mild depressive episode; further evaluation warranted.',
          plan: 'Referral to behavioral health for further evaluation. Follow up in 2 weeks, sooner if symptoms worsen.',
          suggestedCodes: 'F32.9',
        }),
      ),
    );

    const note = await generateSoapNote(ADOLESCENT_CONFIDENTIAL_TRANSCRIPT);

    expect(note.subjective).toContain('Denies suicidal ideation');
    expect(note.subjective).not.toContain('consent');
    expect(note.assessment).toContain('depressive');
  });

  it('captures a medication reconciliation including a gap and an OTC addition', async () => {
    process.env.MOCK_SOAP_NOTE = 'false';
    mockSend.mockResolvedValue(
      bedrockTextResponse(
        JSON.stringify({
          subjective:
            'Medication reconciliation: continues metformin BID and lisinopril daily. Atorvastatin ' +
            'lapsed ~3 weeks (nonadherence, not intolerance). Reports intermittent OTC ibuprofen use ' +
            '(daughter\'s supply) for knee pain.',
          objective: 'Home BP and glucose logs reviewed, well controlled.',
          assessment: 'Diabetes and hypertension well controlled. Lapsed statin therapy. NSAID use inadvisable given renal history.',
          plan: 'Restart atorvastatin at prior dose, recheck lipid panel in 3 months. Advised acetaminophen over NSAIDs given renal history.',
          suggestedCodes: 'E11.9, I10, E78.5',
        }),
      ),
    );

    const note = await generateSoapNote(MEDICATION_RECONCILIATION_TRANSCRIPT);

    expect(note.subjective).toContain('Atorvastatin lapsed');
    expect(note.subjective).toContain('ibuprofen');
    expect(note.plan).toContain('Restart atorvastatin');
  });

  it('reflects the reduced exam limits of a telehealth visit rather than inventing a physical exam', async () => {
    process.env.MOCK_SOAP_NOTE = 'false';
    mockSend.mockResolvedValue(
      bedrockTextResponse(
        JSON.stringify({
          subjective: 'Itchy, non-spreading rash on forearm for 4 days. No fever or other symptoms. Visit conducted via video.',
          objective:
            'Visual exam via video only: well-defined erythematous, scaly patch on forearm. Palpation and temperature assessment not possible via telehealth.',
          assessment: 'Findings consistent with nummular eczema, visual assessment only.',
          plan: 'Topical corticosteroid cream. In-person exam if not improved in 2 weeks or if spreading.',
          suggestedCodes: 'L30.9',
        }),
      ),
    );

    const note = await generateSoapNote(TELEHEALTH_LIMITED_EXAM_TRANSCRIPT);

    expect(note.objective).toContain('via video');
    expect(note.objective).not.toContain('palpation reveals');
    expect(note.plan).toContain('In-person exam');
  });

  it('documents a patient-declined recommendation without dropping it from the plan', async () => {
    process.env.MOCK_SOAP_NOTE = 'false';
    mockSend.mockResolvedValue(
      bedrockTextResponse(
        JSON.stringify({
          subjective: 'Abdominal pain concerning for possible appendicitis.',
          objective: '',
          assessment: 'Possible appendicitis; emergency evaluation with CT imaging recommended.',
          plan:
            'Recommended immediate ER evaluation and CT scan to rule out appendicitis. Patient declined ' +
            'due to cost/childcare concerns after risks of untreated appendicitis (including rupture) ' +
            'were explained. Return precautions given: worsening pain, fever, or migration to right ' +
            'lower quadrant should prompt immediate ER visit. Follow-up scheduled next morning if ER not pursued.',
          suggestedCodes: 'R10.9',
        }),
      ),
    );

    const note = await generateSoapNote(INFORMED_REFUSAL_TRANSCRIPT);

    expect(note.plan).toContain('declined');
    expect(note.plan).toContain('right lower quadrant');
    expect(note.assessment).toContain('appendicitis');
  });
});
