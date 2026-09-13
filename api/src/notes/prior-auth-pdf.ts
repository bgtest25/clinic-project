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
  drawBox,
  addConfidentialityFooter,
} from './pdf-utils';

interface PriorAuthData {
  patientName: string;
  patientDob: string;
  visitDate: string;
  clinicName: string;
  clinicAddress?: string;
  clinicPhone?: string;
  clinicNpi?: string;
  clinicianName: string;
  clinicianCredentials?: string;
  procedureOrMed: string;
  diagnosisCode: string | null;
  insurerName: string | null;
  clinicalRationale: string;
  clinic?: ClinicInfo;
  clinician?: ClinicianInfo;
}

export async function buildPriorAuthPdf(data: PriorAuthData): Promise<PDFKit.PDFDocument> {
  const doc = new PDFDocument({
    size: 'LETTER',
    margins: { top: 40, bottom: 60, left: 54, right: 54 },
    bufferPages: true,
  });

  const clinic = data.clinic;
  const clinician = data.clinician;
  const clinicDisplayName = clinic?.name || data.clinicName;
  const pageWidth = doc.page.width;

  // Fetch signature in parallel
  const signatureBuffer = clinician?.signatureImageUrl
    ? await fetchImage(clinician.signatureImageUrl)
    : null;

  // Header banner
  doc.rect(0, 0, pageWidth, 100).fillColor(COLORS.brand).fill();

  doc.fontSize(22).font('Helvetica-Bold').fillColor(COLORS.white)
    .text('PRIOR AUTHORIZATION REQUEST', 54, 22, { align: 'center' });
  doc.fontSize(14).font('Helvetica').text(clinicDisplayName, 54, 50, { align: 'center' });

  // Clinic contact info in header
  const address = formatAddress(clinic || {} as ClinicInfo) || data.clinicAddress;
  if (address) {
    doc.fontSize(9).text(address, 54, 68, { align: 'center' });
  }
  const phone = clinic?.phone || data.clinicPhone;
  if (phone || clinic?.fax) {
    doc.fontSize(9).text(formatContactLine(clinic || {} as ClinicInfo), 54, 80, { align: 'center' });
  }

  doc.y = 115;
  doc.x = 54;
  doc.fillColor(COLORS.text);

  // Two-column layout for patient and request info
  const leftColX = 54;
  const rightColX = 310;
  const colWidth = 230;
  const boxHeight = 100;

  // Patient Information Box
  let boxY = doc.y;
  drawBox(doc, leftColX, boxY, colWidth, boxHeight, { fill: COLORS.surface, stroke: COLORS.border });

  doc.y = boxY + 10;
  doc.x = leftColX + 12;
  doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORS.brand).text('PATIENT INFORMATION');
  doc.y += 6;
  doc.x = leftColX + 12;
  doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORS.text)
    .text('Name: ', { continued: true }).font('Helvetica').text(data.patientName);
  doc.x = leftColX + 12;
  doc.font('Helvetica-Bold').text('DOB: ', { continued: true }).font('Helvetica').text(data.patientDob);
  doc.x = leftColX + 12;
  doc.font('Helvetica-Bold').text('Visit Date: ', { continued: true }).font('Helvetica').text(data.visitDate);
  if (data.insurerName) {
    doc.x = leftColX + 12;
    doc.font('Helvetica-Bold').text('Insurance: ', { continued: true }).font('Helvetica').text(data.insurerName);
  }

  // Request Information Box
  doc.y = boxY;
  drawBox(doc, rightColX, boxY, colWidth, boxHeight, { fill: COLORS.surface, stroke: COLORS.border });

  doc.y = boxY + 10;
  doc.x = rightColX + 12;
  doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORS.brand).text('REQUEST INFORMATION');
  doc.y += 6;
  doc.x = rightColX + 12;
  doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORS.text).text('Requested Service:');
  doc.x = rightColX + 12;
  doc.font('Helvetica').text(data.procedureOrMed, { width: colWidth - 24 });
  if (data.diagnosisCode) {
    doc.x = rightColX + 12;
    doc.font('Helvetica-Bold').text('Diagnosis Code: ', { continued: true }).font('Helvetica').text(data.diagnosisCode);
  }

  doc.y = boxY + boxHeight + 20;
  doc.x = 54;

  // Clinical Rationale title
  doc.fontSize(12).font('Helvetica-Bold').fillColor(COLORS.brand)
    .text('CLINICAL RATIONALE FOR MEDICAL NECESSITY');
  doc.moveDown(0.5);

  // Parse and render the clinical rationale sections
  const sections = parseRationale(data.clinicalRationale);
  for (const section of sections) {
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORS.brand).text(section.title);
    doc.moveDown(0.25);

    // Handle bullet points in content
    const lines = section.content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.match(/^\d+\./)) {
        doc.fontSize(10).font('Helvetica').fillColor(COLORS.text).text(trimmed, { indent: 15, width: 504 });
      } else if (trimmed) {
        doc.fontSize(10).font('Helvetica').fillColor(COLORS.text).text(trimmed, { width: 504 });
      }
    }
  }

  // Attestation box
  doc.moveDown(1);
  const attestY = doc.y;
  const attestHeight = 80;
  drawBox(doc, 54, attestY, 504, attestHeight, { fill: COLORS.successBg, stroke: COLORS.success });

  doc.y = attestY + 12;
  doc.x = 68;
  doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORS.successText).text('PROVIDER ATTESTATION');
  doc.moveDown(0.3);
  doc.x = 68;
  doc.font('Helvetica').fillColor(COLORS.text).text(
    'I certify that the above information is accurate and that the requested service is medically necessary for this patient.',
    { width: 476 },
  );
  doc.moveDown(0.5);

  // Signature
  if (signatureBuffer) {
    try {
      doc.image(signatureBuffer, 68, doc.y, { width: 100, height: 30 });
      doc.y += 35;
    } catch {
      // Fall through to text
    }
  }

  doc.x = 68;
  const providerName = formatProviderName(clinician || { name: data.clinicianName, credentials: data.clinicianCredentials });
  doc.font('Helvetica-Bold').fillColor(COLORS.text).text(providerName, { continued: true });
  doc.font('Helvetica').fillColor(COLORS.muted).text(`  |  ${clinicDisplayName}`);
  if (clinician?.individualNpi) {
    doc.x = 68;
    doc.fontSize(9).text(`Provider NPI: ${clinician.individualNpi}`);
  }

  // Footer
  doc.y = doc.page.height - 60;
  doc.moveTo(54, doc.y).lineTo(558, doc.y).strokeColor(COLORS.border).lineWidth(1).stroke();
  doc.moveDown(0.5);

  const clinicNpi = clinic?.npi || data.clinicNpi;
  doc.fontSize(9).fillColor(COLORS.muted).text(
    `Generated ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} | ${clinicDisplayName}`,
    { align: 'center' },
  );
  if (clinicNpi) {
    doc.text(`Organization NPI: ${clinicNpi}`, { align: 'center' });
  }

  addConfidentialityFooter(doc, 'PRIOR AUTHORIZATION REQUEST — CONFIDENTIAL');

  return doc;
}

function parseRationale(rationale: string): Array<{ title: string; content: string }> {
  const sections: Array<{ title: string; content: string }> = [];
  const lines = rationale.split('\n');
  let currentTitle = '';
  let currentContent: string[] = [];

  const sectionTitles = [
    'PATIENT INFORMATION',
    'REQUESTED SERVICE',
    'CLINICAL INDICATION',
    'SUPPORTING EVIDENCE',
    'TREATMENT HISTORY',
    'EXPECTED BENEFIT',
    'URGENCY',
  ];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const matchedTitle = sectionTitles.find((t) => {
      const normalized = trimmed.toUpperCase().replace(/[:\-—\d.]/g, '').trim();
      return normalized === t || normalized.startsWith(t);
    });

    if (matchedTitle) {
      if (currentTitle && currentContent.length) {
        sections.push({ title: currentTitle, content: currentContent.join('\n').trim() });
      }
      currentTitle = matchedTitle;
      const afterTitle = trimmed.slice(trimmed.toUpperCase().indexOf(matchedTitle) + matchedTitle.length).replace(/^[:\-—\s]+/, '').trim();
      currentContent = afterTitle ? [afterTitle] : [];
    } else if (currentTitle) {
      currentContent.push(trimmed);
    } else {
      if (!sections.length) {
        currentTitle = 'SUMMARY';
        currentContent.push(trimmed);
      }
    }
  }

  if (currentTitle && currentContent.length) {
    sections.push({ title: currentTitle, content: currentContent.join('\n').trim() });
  }

  return sections.filter((s) => s.title !== 'PATIENT INFORMATION');
}
