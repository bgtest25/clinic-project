import PDFDocument from 'pdfkit';

interface ClinicInfo {
  name: string;
  addressStreet?: string;
  addressCity?: string;
  addressState?: string;
  addressZip?: string;
  phone?: string;
  fax?: string;
  npi?: string;
  logoUrl?: string;
}

interface ClinicianInfo {
  name: string;
  credentials?: string;
  title?: string;
  specialty?: string;
  individualNpi?: string;
  signatureImageUrl?: string;
}

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

const BRAND_COLOR = '#0f766e';
const TEXT_COLOR = '#0f172a';
const MUTED_COLOR = '#64748b';
const BOX_BG = '#f8fafc';
const BOX_BORDER = '#e2e8f0';

export function buildPriorAuthPdf(data: PriorAuthData): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: 'LETTER', margins: { top: 40, bottom: 40, left: 54, right: 54 } });
  const clinic = data.clinic;
  const clinician = data.clinician;
  const clinicDisplayName = clinic?.name || data.clinicName;

  // Header banner
  doc.rect(0, 0, 612, 90).fillColor(BRAND_COLOR).fill();
  doc.fontSize(22).font('Helvetica-Bold').fillColor('#ffffff').text('PRIOR AUTHORIZATION REQUEST', 54, 20, { align: 'center' });
  doc.fontSize(13).font('Helvetica').text(clinicDisplayName, 54, 48, { align: 'center' });

  // Clinic contact info in header
  const address = clinic?.addressStreet
    ? [clinic.addressStreet, clinic.addressCity, clinic.addressState, clinic.addressZip].filter(Boolean).join(', ')
    : data.clinicAddress;
  if (address) {
    doc.fontSize(9).text(address, 54, 65, { align: 'center' });
  }
  const phone = clinic?.phone || data.clinicPhone;
  if (phone || clinic?.fax) {
    const contactLine = [phone ? `Tel: ${formatPhone(phone)}` : '', clinic?.fax ? `Fax: ${formatPhone(clinic.fax)}` : ''].filter(Boolean).join('  |  ');
    doc.fontSize(9).text(contactLine, 54, 76, { align: 'center' });
  }

  doc.y = 100;
  doc.x = 54;
  doc.fillColor(TEXT_COLOR);

  // Two-column layout for patient and request info
  const leftColX = 54;
  const rightColX = 310;
  const colWidth = 230;

  // Patient Information Box
  let boxY = doc.y;
  doc.rect(leftColX, boxY, colWidth, 90).fillColor(BOX_BG).fill();
  doc.rect(leftColX, boxY, colWidth, 90).strokeColor(BOX_BORDER).lineWidth(1).stroke();
  doc.y = boxY + 8;
  doc.x = leftColX + 10;
  doc.fontSize(10).font('Helvetica-Bold').fillColor(BRAND_COLOR).text('PATIENT INFORMATION');
  doc.y += 4;
  doc.x = leftColX + 10;
  doc.fontSize(10).font('Helvetica-Bold').fillColor(TEXT_COLOR).text('Name: ', { continued: true }).font('Helvetica').text(data.patientName);
  doc.x = leftColX + 10;
  doc.font('Helvetica-Bold').text('DOB: ', { continued: true }).font('Helvetica').text(data.patientDob);
  doc.x = leftColX + 10;
  doc.font('Helvetica-Bold').text('Visit Date: ', { continued: true }).font('Helvetica').text(data.visitDate);
  if (data.insurerName) {
    doc.x = leftColX + 10;
    doc.font('Helvetica-Bold').text('Insurance: ', { continued: true }).font('Helvetica').text(data.insurerName);
  }

  // Request Information Box
  doc.y = boxY;
  doc.rect(rightColX, boxY, colWidth, 90).fillColor(BOX_BG).fill();
  doc.rect(rightColX, boxY, colWidth, 90).strokeColor(BOX_BORDER).lineWidth(1).stroke();
  doc.y = boxY + 8;
  doc.x = rightColX + 10;
  doc.fontSize(10).font('Helvetica-Bold').fillColor(BRAND_COLOR).text('REQUEST INFORMATION');
  doc.y += 4;
  doc.x = rightColX + 10;
  doc.fontSize(10).font('Helvetica-Bold').fillColor(TEXT_COLOR).text('Requested Service:');
  doc.x = rightColX + 10;
  doc.font('Helvetica').text(data.procedureOrMed, { width: colWidth - 20 });
  if (data.diagnosisCode) {
    doc.x = rightColX + 10;
    doc.font('Helvetica-Bold').text('Diagnosis Code: ', { continued: true }).font('Helvetica').text(data.diagnosisCode);
  }

  doc.y = boxY + 100;
  doc.x = 54;

  // Clinical Rationale
  doc.fontSize(11).font('Helvetica-Bold').fillColor(BRAND_COLOR).text('CLINICAL RATIONALE FOR MEDICAL NECESSITY');
  doc.moveDown(0.5);

  // Parse and render the clinical rationale sections
  const sections = parseRationale(data.clinicalRationale);
  for (const section of sections) {
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica-Bold').fillColor(BRAND_COLOR).text(section.title);
    doc.moveDown(0.25);
    doc.fontSize(10).font('Helvetica').fillColor(TEXT_COLOR).text(section.content, { width: 504 });
  }

  // Attestation box
  doc.moveDown(1);
  const attestY = doc.y;
  doc.rect(54, attestY, 504, 70).fillColor('#f0fdf4').fill();
  doc.rect(54, attestY, 504, 70).strokeColor('#22c55e').lineWidth(1).stroke();
  doc.y = attestY + 10;
  doc.x = 64;
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#166534').text('PROVIDER ATTESTATION');
  doc.moveDown(0.25);
  doc.x = 64;
  doc.font('Helvetica').fillColor(TEXT_COLOR).text(
    'I certify that the above information is accurate and that the requested service is medically necessary for this patient.',
    { width: 484 },
  );
  doc.moveDown(0.5);
  doc.x = 64;
  const providerName = clinician?.name || data.clinicianName;
  const providerCreds = clinician?.credentials || data.clinicianCredentials;
  doc.font('Helvetica-Bold').text(providerName, { continued: true });
  if (providerCreds) {
    doc.font('Helvetica').text(`, ${providerCreds}`, { continued: true });
  }
  doc.font('Helvetica').fillColor(MUTED_COLOR).text(`  |  ${clinicDisplayName}`);
  if (clinician?.individualNpi) {
    doc.x = 64;
    doc.fontSize(9).text(`Provider NPI: ${clinician.individualNpi}`, { continued: false });
  }

  // Footer
  const footerY = 720;
  doc.y = footerY;
  doc.moveTo(54, footerY).lineTo(558, footerY).strokeColor(BOX_BORDER).lineWidth(1).stroke();
  doc.moveDown(0.5);
  const clinicNpi = clinic?.npi || data.clinicNpi;
  doc.fontSize(9).fillColor(MUTED_COLOR).text(
    `Generated ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} | ${clinicDisplayName}`,
    { align: 'center' },
  );
  if (clinicNpi) {
    doc.text(`Organization NPI: ${clinicNpi}`, { align: 'center' });
  }

  return doc;
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
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
      // Content before any section header
      if (!sections.length) {
        currentTitle = 'SUMMARY';
        currentContent.push(trimmed);
      }
    }
  }

  if (currentTitle && currentContent.length) {
    sections.push({ title: currentTitle, content: currentContent.join('\n').trim() });
  }

  // Filter out "PATIENT INFORMATION" since we show it in the header box
  return sections.filter((s) => s.title !== 'PATIENT INFORMATION');
}
