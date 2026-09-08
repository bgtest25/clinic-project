import { AiService } from './ai.service';

const mockSend = jest.fn();
jest.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: jest.fn().mockImplementation(() => ({ send: mockSend })),
  ConverseCommand: jest.fn().mockImplementation((input) => input),
}));

describe('AiService', () => {
  let service: AiService;

  const mockTextResponse = (text: string) => ({
    output: { message: { content: [{ text }] } },
  });

  beforeEach(() => {
    service = new AiService();
    mockSend.mockReset();
  });

  describe('generateAfterVisitSummary', () => {
    const avsInput = {
      patientName: 'John Doe',
      visitDate: '2026-09-08',
      clinicName: 'Test Clinic',
      subjective: 'Patient reports headache for 3 days',
      objective: 'BP 120/80, alert and oriented',
      assessment: 'Tension headache',
      plan: 'Ibuprofen 400mg PRN, follow up if no improvement',
    };

    it('calls Bedrock with correct parameters', async () => {
      mockSend.mockResolvedValue(mockTextResponse('Summary content'));
      await service.generateAfterVisitSummary(avsInput);

      expect(mockSend).toHaveBeenCalledTimes(1);
      const command = mockSend.mock.calls[0][0];
      expect(command.modelId).toContain('anthropic');
      expect(command.system[0].text).toContain('patient-friendly visit summary');
      expect(command.messages[0].content[0].text).toContain('John Doe');
      expect(command.messages[0].content[0].text).toContain('Tension headache');
    });

    it('returns the generated text', async () => {
      mockSend.mockResolvedValue(mockTextResponse('Your visit summary here'));
      const result = await service.generateAfterVisitSummary(avsInput);
      expect(result).toBe('Your visit summary here');
    });

    it('throws if Bedrock returns no text content', async () => {
      mockSend.mockResolvedValue({ output: { message: { content: [] } } });
      await expect(service.generateAfterVisitSummary(avsInput)).rejects.toThrow(
        'No text content in Bedrock response',
      );
    });

    it('handles missing SOAP sections gracefully', async () => {
      mockSend.mockResolvedValue(mockTextResponse('Summary'));
      const partialInput = { ...avsInput, objective: '', assessment: '' };
      await service.generateAfterVisitSummary(partialInput);

      const command = mockSend.mock.calls[0][0];
      expect(command.messages[0].content[0].text).toContain('Not documented');
    });
  });

  describe('generateReferralLetter', () => {
    const referralInput = {
      patientName: 'Jane Smith',
      patientDob: '1985-03-15',
      visitDate: '2026-09-08',
      clinicName: 'Primary Care Clinic',
      clinicianName: 'Dr. Johnson',
      specialty: 'Cardiology',
      reason: 'Chest pain evaluation',
      subjective: 'Intermittent chest pain for 2 weeks',
      objective: 'HR 88, BP 140/90, no murmurs',
      assessment: 'Atypical chest pain, rule out cardiac etiology',
      plan: 'Refer to cardiology for stress test',
    };

    it('calls Bedrock with specialty and reason', async () => {
      mockSend.mockResolvedValue(mockTextResponse('Dear Cardiology Colleagues'));
      await service.generateReferralLetter(referralInput);

      const command = mockSend.mock.calls[0][0];
      expect(command.system[0].text).toContain('referral letter');
      expect(command.messages[0].content[0].text).toContain('Cardiology');
      expect(command.messages[0].content[0].text).toContain('Chest pain evaluation');
    });

    it('returns the generated letter', async () => {
      const letter = 'Dear Cardiology Colleagues,\n\nI am referring...';
      mockSend.mockResolvedValue(mockTextResponse(letter));
      const result = await service.generateReferralLetter(referralInput);
      expect(result).toBe(letter);
    });

    it('throws if Bedrock returns no text content', async () => {
      mockSend.mockResolvedValue({ output: { message: { content: [] } } });
      await expect(service.generateReferralLetter(referralInput)).rejects.toThrow(
        'No text content in Bedrock response',
      );
    });
  });

  describe('generatePriorAuth', () => {
    const priorAuthInput = {
      patientName: 'Bob Wilson',
      patientDob: '1970-07-22',
      visitDate: '2026-09-08',
      clinicName: 'Specialty Clinic',
      clinicianName: 'Dr. Lee',
      procedureOrMed: 'MRI of lumbar spine',
      diagnosisCode: 'M54.5',
      insurerName: 'Blue Cross',
      subjective: 'Chronic low back pain, failed conservative treatment',
      objective: 'Limited ROM, positive straight leg raise',
      assessment: 'Lumbar radiculopathy',
      plan: 'MRI to evaluate for disc herniation',
    };

    it('calls Bedrock with procedure and diagnosis info', async () => {
      mockSend.mockResolvedValue(mockTextResponse('Prior auth rationale'));
      await service.generatePriorAuth(priorAuthInput);

      const command = mockSend.mock.calls[0][0];
      expect(command.system[0].text).toContain('prior authorization');
      expect(command.messages[0].content[0].text).toContain('MRI of lumbar spine');
      expect(command.messages[0].content[0].text).toContain('M54.5');
      expect(command.messages[0].content[0].text).toContain('Blue Cross');
    });

    it('handles optional fields being null', async () => {
      mockSend.mockResolvedValue(mockTextResponse('Prior auth rationale'));
      const minimalInput = { ...priorAuthInput, diagnosisCode: null, insurerName: null };
      await service.generatePriorAuth(minimalInput);

      const command = mockSend.mock.calls[0][0];
      expect(command.messages[0].content[0].text).not.toContain('Diagnosis Code:');
      expect(command.messages[0].content[0].text).not.toContain('Insurance:');
    });

    it('returns the generated rationale', async () => {
      const rationale = 'PATIENT INFORMATION\nBob Wilson...';
      mockSend.mockResolvedValue(mockTextResponse(rationale));
      const result = await service.generatePriorAuth(priorAuthInput);
      expect(result).toBe(rationale);
    });

    it('throws if Bedrock returns no text content', async () => {
      mockSend.mockResolvedValue({ output: { message: { content: [] } } });
      await expect(service.generatePriorAuth(priorAuthInput)).rejects.toThrow(
        'No text content in Bedrock response',
      );
    });
  });
});
