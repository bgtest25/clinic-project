import PDFDocument from 'pdfkit';

interface ReferralData {
  patientName: string;
  patientDob: string;
  visitDate: string;
  clinicName: string;
  clinicAddress?: string;
  clinicPhone?: string;
  clinicianName: string;
  clinicianCredentials?: string;
  specialty: string;
  reason: string;
  letterContent: string;
}

const BRAND_COLOR = '#0f766e';
const TEXT_COLOR = '#0f172a';
const MUTED_COLOR = '#64748b';

export function buildReferralPdf(data: ReferralData): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: 'LETTER', margins: { top: 50, bottom: 50, left: 72, right: 72 } });

  // Letterhead
  doc.fontSize(18).font('Helvetica-Bold').fillColor(BRAND_COLOR).text(data.clinicName);
  if (data.clinicAddress) {
    doc.fontSize(10).font('Helvetica').fillColor(MUTED_COLOR).text(data.clinicAddress);
  }
  if (data.clinicPhone) {
    doc.fontSize(10).font('Helvetica').fillColor(MUTED_COLOR).text(data.clinicPhone);
  }
  doc.moveDown(0.5);

  // Horizontal rule
  doc.moveTo(72, doc.y).lineTo(540, doc.y).strokeColor(BRAND_COLOR).lineWidth(2).stroke();
  doc.moveDown(1.5);

  // Date
  doc.fontSize(11).font('Helvetica').fillColor(TEXT_COLOR).text(new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }));
  doc.moveDown(1);

  // RE: Patient info
  doc.font('Helvetica-Bold').text('RE: ', { continued: true }).font('Helvetica').text(data.patientName);
  doc.font('Helvetica-Bold').text('DOB: ', { continued: true }).font('Helvetica').text(data.patientDob);
  doc.font('Helvetica-Bold').text('Visit Date: ', { continued: true }).font('Helvetica').text(data.visitDate);
  doc.moveDown(1);

  // Letter body
  const lines = data.letterContent.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      doc.moveDown(0.5);
      continue;
    }

    // Check if it's a section header (all caps or ends with colon)
    if (isSectionHeader(trimmed)) {
      doc.moveDown(0.5);
      doc.font('Helvetica-Bold').fillColor(BRAND_COLOR).text(trimmed);
      doc.font('Helvetica').fillColor(TEXT_COLOR);
    } else if (trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.match(/^\d+\./)) {
      // Bullet or numbered item
      doc.text(trimmed, { indent: 20 });
    } else {
      doc.text(trimmed);
    }
  }

  // Signature block
  doc.moveDown(2);
  doc.text('Thank you for your excellent care of this patient.');
  doc.moveDown(1.5);
  doc.text('Sincerely,');
  doc.moveDown(1);
  doc.font('Helvetica-Bold').text(data.clinicianName);
  if (data.clinicianCredentials) {
    doc.font('Helvetica').text(data.clinicianCredentials);
  }
  doc.font('Helvetica').fillColor(MUTED_COLOR).text(data.clinicName);

  // Footer
  const footerY = 720;
  doc.y = footerY;
  doc.moveTo(72, footerY).lineTo(540, footerY).strokeColor('#e2e8f0').lineWidth(1).stroke();
  doc.moveDown(0.5);
  doc.fontSize(9).fillColor(MUTED_COLOR).text('CONFIDENTIAL MEDICAL REFERRAL', { align: 'center' });
  doc.text(`Referral to ${data.specialty} — ${data.reason}`, { align: 'center' });

  return doc;
}

function isSectionHeader(text: string): boolean {
  const headers = [
    'REASON FOR REFERRAL',
    'RELEVANT HISTORY',
    'CURRENT MEDICATIONS',
    'RECENT FINDINGS',
    'CLINICAL QUESTION',
    'ALLERGIES',
    'SOCIAL HISTORY',
    'FAMILY HISTORY',
  ];
  const upper = text.toUpperCase().replace(/[:\-—]/g, '').trim();
  return headers.some((h) => upper === h || upper.startsWith(h));
}
