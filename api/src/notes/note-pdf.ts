import PDFDocument from 'pdfkit';
import type { ClinicalNote, Encounter, Patient, User } from '@prisma/client';

type EncounterWithParties = Encounter & { patient: Patient; clinician: User };

const SECTION_LABELS: Record<string, string> = {
  subjective: 'Subjective',
  objective: 'Objective',
  assessment: 'Assessment',
  plan: 'Plan',
};

export function buildNotePdf(note: ClinicalNote, encounter: EncounterWithParties): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: 'LETTER', margin: 54 });

  doc.fontSize(18).font('Helvetica-Bold').fillColor('#0f172a').text('Havenote');
  doc.fontSize(10).font('Helvetica').fillColor('#475569').text('Clinical Visit Note').moveDown(1);

  doc.fontSize(11).fillColor('#0f172a');
  const detail = (label: string, value: string) => {
    doc.font('Helvetica-Bold').text(`${label}: `, { continued: true }).font('Helvetica').text(value);
  };
  detail('Patient', encounter.patient.name);
  detail('Date of birth', new Date(encounter.patient.dateOfBirth).toLocaleDateString());
  detail('Visit date', new Date(encounter.visitDate).toLocaleDateString());
  detail('Clinician', encounter.clinician.name);
  doc.moveDown(1);

  if (note.status === 'SIGNED') {
    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor('#166534')
      .text(
        `SIGNED ${note.signedAt ? new Date(note.signedAt).toLocaleString() : ''}${
          note.version > 1 ? ` — version ${note.version}` : ''
        }`,
      );
  } else {
    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor('#92400e')
      .text(`DRAFT — NOT YET SIGNED${note.status === 'AMENDED' ? ' (amendment in progress)' : ''}`);
  }
  doc.moveDown(0.75);

  for (const field of ['subjective', 'objective', 'assessment', 'plan'] as const) {
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f766e').text(SECTION_LABELS[field].toUpperCase());
    doc
      .font('Helvetica')
      .fontSize(11)
      .fillColor('#0f172a')
      .text(note[field] || '—');
    doc.moveDown(0.75);
  }

  if (note.suggestedCodes) {
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f766e').text('SUGGESTED CODES');
    doc.font('Helvetica').fontSize(11).fillColor('#0f172a').text(String(note.suggestedCodes));
  }

  return doc;
}
