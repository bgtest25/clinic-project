import PDFDocument from 'pdfkit';
import {
  COLORS,
  type ClinicInfo,
  type ClinicianInfo,
  formatPhone,
  formatAddress,
  formatContactLine,
  formatProviderName,
  fetchImage,
  drawHorizontalRule,
  drawBox,
  addConfidentialityFooter,
} from './pdf-utils';

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
  clinic?: ClinicInfo;
  clinician?: ClinicianInfo;
}

export async function buildReferralPdf(data: ReferralData): Promise<PDFKit.PDFDocument> {
  const doc = new PDFDocument({
    size: 'LETTER',
    margins: { top: 50, bottom: 60, left: 72, right: 72 },
    bufferPages: true,
  });

  const clinic = data.clinic;
  const clinician = data.clinician;
  const pageWidth = doc.page.width;
  const contentWidth = pageWidth - 144;

  // Fetch logo and signature in parallel
  const [logoBuffer, signatureBuffer] = await Promise.all([
    clinic?.logoUrl ? fetchImage(clinic.logoUrl) : Promise.resolve(null),
    clinician?.signatureImageUrl ? fetchImage(clinician.signatureImageUrl) : Promise.resolve(null),
  ]);

  // Letterhead
  let headerY = 50;

  if (logoBuffer) {
    try {
      doc.image(logoBuffer, 72, headerY, { width: 45, height: 45 });
      doc.fontSize(18).font('Helvetica-Bold').fillColor(COLORS.brand)
        .text(clinic?.name || data.clinicName, 127, headerY + 5);

      const address = formatAddress(clinic || {} as ClinicInfo) || data.clinicAddress;
      if (address) {
        doc.fontSize(10).font('Helvetica').fillColor(COLORS.muted)
          .text(address, 127, headerY + 25);
      }
      const contact = formatContactLine(clinic || {} as ClinicInfo);
      if (contact) {
        doc.fontSize(10).text(contact, 127, headerY + 38);
      }
      headerY += 55;
    } catch {
      // Fall back to text-only
      doc.fontSize(20).font('Helvetica-Bold').fillColor(COLORS.brand)
        .text(clinic?.name || data.clinicName);
      headerY = doc.y;
    }
  } else {
    doc.fontSize(20).font('Helvetica-Bold').fillColor(COLORS.brand)
      .text(clinic?.name || data.clinicName);

    const address = formatAddress(clinic || {} as ClinicInfo) || data.clinicAddress;
    if (address) {
      doc.fontSize(10).font('Helvetica').fillColor(COLORS.muted).text(address);
    }

    const phone = clinic?.phone || data.clinicPhone;
    if (phone || clinic?.fax) {
      doc.fontSize(10).font('Helvetica').fillColor(COLORS.muted)
        .text(formatContactLine(clinic || {} as ClinicInfo));
    }
    headerY = doc.y;
  }

  if (clinic?.npi) {
    doc.fontSize(9).font('Helvetica').fillColor(COLORS.muted).text(`NPI: ${clinic.npi}`);
  }
  doc.moveDown(0.5);

  // Decorative line
  drawHorizontalRule(doc, doc.y, COLORS.brand, 2, 72, 72);
  doc.moveDown(1);

  // Confidential header
  doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORS.danger)
    .text('CONFIDENTIAL MEDICAL REFERRAL', { align: 'center' });
  doc.moveDown(1);

  // Date
  doc.fontSize(11).font('Helvetica').fillColor(COLORS.text).text(new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }));
  doc.moveDown(0.75);

  // Patient info box
  const boxTop = doc.y;
  const boxHeight = 55;
  drawBox(doc, 72, boxTop, contentWidth, boxHeight, { fill: COLORS.successBg, stroke: COLORS.border });

  doc.y = boxTop + 12;
  const colWidth = contentWidth / 3;

  // Patient Name
  doc.x = 85;
  doc.fontSize(9).font('Helvetica-Bold').fillColor(COLORS.muted).text('PATIENT');
  doc.x = 85;
  doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.text).text(data.patientName);

  // DOB
  doc.y = boxTop + 12;
  doc.x = 85 + colWidth;
  doc.fontSize(9).font('Helvetica-Bold').fillColor(COLORS.muted).text('DATE OF BIRTH');
  doc.x = 85 + colWidth;
  doc.fontSize(11).font('Helvetica').fillColor(COLORS.text).text(data.patientDob);

  // Visit Date
  doc.y = boxTop + 12;
  doc.x = 85 + colWidth * 2;
  doc.fontSize(9).font('Helvetica-Bold').fillColor(COLORS.muted).text('VISIT DATE');
  doc.x = 85 + colWidth * 2;
  doc.fontSize(11).font('Helvetica').fillColor(COLORS.text).text(data.visitDate);

  doc.x = 72;
  doc.y = boxTop + boxHeight + 15;

  // Referral info
  doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORS.brand).text('REFERRAL TO: ')
    .font('Helvetica').fillColor(COLORS.text).text(`${data.specialty}`);
  doc.font('Helvetica-Bold').fillColor(COLORS.brand).text('REASON: ')
    .font('Helvetica').fillColor(COLORS.text).text(data.reason);
  doc.moveDown(1);

  // Letter body
  const lines = data.letterContent.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      doc.moveDown(0.5);
      continue;
    }

    if (isSectionHeader(trimmed)) {
      doc.moveDown(0.5);
      doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.brand).text(trimmed);
      doc.font('Helvetica').fillColor(COLORS.text);
    } else if (trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.match(/^\d+\./)) {
      doc.fontSize(11).text(trimmed, { indent: 20 });
    } else {
      doc.fontSize(11).text(trimmed);
    }
  }

  // Signature block
  doc.moveDown(1.5);
  doc.text('Thank you for your excellent care of this patient.');
  doc.moveDown(1);
  doc.text('Sincerely,');
  doc.moveDown(0.75);

  // Render signature image if available
  if (signatureBuffer) {
    try {
      doc.image(signatureBuffer, 72, doc.y, { width: 120, height: 40 });
      doc.moveDown(2.5);
    } catch {
      // Fall through to text signature
    }
  }

  const providerName = formatProviderName(clinician || { name: data.clinicianName, credentials: data.clinicianCredentials });
  doc.font('Helvetica-Bold').text(providerName);
  if (clinician?.title) {
    doc.font('Helvetica').text(clinician.title);
  }
  if (clinician?.individualNpi) {
    doc.font('Helvetica').fillColor(COLORS.muted).text(`NPI: ${clinician.individualNpi}`);
  }
  doc.fillColor(COLORS.text).font('Helvetica').text(clinic?.name || data.clinicName);

  // Footer
  addConfidentialityFooter(doc, `CONFIDENTIAL MEDICAL REFERRAL — ${data.specialty}`);

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
    'DEAR',
  ];
  const upper = text.toUpperCase().replace(/[:\-—]/g, '').trim();
  return headers.some((h) => upper === h || upper.startsWith(h));
}
