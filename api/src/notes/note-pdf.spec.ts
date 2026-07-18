import { buildNotePdf } from './note-pdf';

function collectPdfBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

describe('buildNotePdf', () => {
  const encounter: any = {
    visitDate: new Date('2026-07-18T09:00:00Z'),
    patient: { name: 'Jane Doe', dateOfBirth: new Date('1990-05-04') },
    clinician: { name: 'Dr. Alex Kim' },
  };

  it('produces a valid, non-empty PDF for a signed note', async () => {
    const note: any = {
      subjective: 'Patient reports mild headache for 2 days.',
      objective: 'Vitals stable.',
      assessment: 'Tension headache.',
      plan: 'OTC analgesics, follow up in 1 week.',
      suggestedCodes: 'R51.9',
      status: 'SIGNED',
      version: 1,
      signedAt: new Date('2026-07-18T12:00:00Z'),
    };

    const buffer = await collectPdfBuffer(buildNotePdf(note, encounter));

    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });

  it('still produces a valid PDF for a draft note with empty fields', async () => {
    const note: any = {
      subjective: null,
      objective: null,
      assessment: null,
      plan: null,
      suggestedCodes: null,
      status: 'DRAFT',
      version: 1,
      signedAt: null,
    };

    const buffer = await collectPdfBuffer(buildNotePdf(note, encounter));

    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });
});
