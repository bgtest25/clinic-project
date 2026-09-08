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

interface AvsData {
  patientName: string;
  patientDob: string;
  visitDate: string;
  clinicName: string;
  clinicianName: string;
  summary: string;
  clinic?: ClinicInfo;
  clinician?: ClinicianInfo;
}

const BRAND_COLOR = '#0f766e';
const TEXT_COLOR = '#0f172a';
const MUTED_COLOR = '#64748b';
const ALERT_BG = '#fef3c7';
const ALERT_BORDER = '#f59e0b';

export function buildAvsPdf(data: AvsData): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: 'LETTER', margins: { top: 50, bottom: 50, left: 54, right: 54 } });
  const clinic = data.clinic;
  const clinician = data.clinician;

  // Professional header with clinic branding
  doc.fontSize(22).font('Helvetica-Bold').fillColor(BRAND_COLOR).text(clinic?.name || data.clinicName, { align: 'center' });

  // Clinic address and contact info
  if (clinic?.addressStreet) {
    const addressLine = [clinic.addressStreet, clinic.addressCity, clinic.addressState, clinic.addressZip].filter(Boolean).join(', ');
    doc.fontSize(10).font('Helvetica').fillColor(MUTED_COLOR).text(addressLine, { align: 'center' });
  }
  if (clinic?.phone || clinic?.fax) {
    const contactLine = [clinic.phone ? `Tel: ${formatPhone(clinic.phone)}` : '', clinic.fax ? `Fax: ${formatPhone(clinic.fax)}` : ''].filter(Boolean).join('  |  ');
    doc.fontSize(10).font('Helvetica').fillColor(MUTED_COLOR).text(contactLine, { align: 'center' });
  }
  doc.moveDown(0.3);
  doc.fontSize(14).font('Helvetica-Bold').fillColor(BRAND_COLOR).text('AFTER-VISIT SUMMARY', { align: 'center' });
  doc.moveDown(0.5);

  // Horizontal rule
  doc.moveTo(54, doc.y).lineTo(558, doc.y).strokeColor(BRAND_COLOR).lineWidth(2).stroke();
  doc.moveDown(0.75);

  // Patient info box
  const boxTop = doc.y;
  doc.rect(54, boxTop, 504, 60).fillColor('#f8fafc').fill();
  doc.fillColor(TEXT_COLOR);
  doc.y = boxTop + 12;
  doc.x = 70;
  doc.fontSize(11).font('Helvetica-Bold').text('Patient: ', { continued: true }).font('Helvetica').text(data.patientName);
  doc.x = 70;
  doc.font('Helvetica-Bold').text('Date of Birth: ', { continued: true }).font('Helvetica').text(data.patientDob);
  doc.x = 300;
  doc.y = boxTop + 12;
  doc.font('Helvetica-Bold').text('Visit Date: ', { continued: true }).font('Helvetica').text(data.visitDate);
  const providerDisplay = clinician
    ? `${clinician.name}${clinician.credentials ? `, ${clinician.credentials}` : ''}`
    : data.clinicianName;
  doc.x = 300;
  doc.font('Helvetica-Bold').text('Provider: ', { continued: true }).font('Helvetica').text(providerDisplay);
  if (clinician?.specialty) {
    doc.x = 300;
    doc.fontSize(10).font('Helvetica').fillColor(MUTED_COLOR).text(clinician.specialty);
    doc.fillColor(TEXT_COLOR);
  }
  doc.x = 54;
  doc.y = boxTop + 72;

  // Parse the summary into sections
  const sections = parseSummary(data.summary);

  for (const section of sections) {
    if (section.title === 'WHEN TO CALL US') {
      // Alert box for "When to call us"
      doc.moveDown(0.5);
      const alertTop = doc.y;
      const alertHeight = estimateTextHeight(doc, section.content, 480) + 40;
      doc.rect(54, alertTop, 504, alertHeight).fillColor(ALERT_BG).fill();
      doc.rect(54, alertTop, 4, alertHeight).fillColor(ALERT_BORDER).fill();
      doc.y = alertTop + 12;
      doc.x = 70;
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#92400e').text(section.title);
      doc.x = 70;
      doc.fontSize(11).font('Helvetica').fillColor(TEXT_COLOR).text(section.content, { width: 480 });
      doc.y = alertTop + alertHeight + 12;
      doc.x = 54;
    } else {
      doc.moveDown(0.75);
      doc.fontSize(12).font('Helvetica-Bold').fillColor(BRAND_COLOR).text(section.title);
      doc.moveDown(0.25);
      doc.fontSize(11).font('Helvetica').fillColor(TEXT_COLOR).text(section.content, { width: 504 });
    }
  }

  // Footer
  doc.moveDown(2);
  doc.moveTo(54, doc.y).lineTo(558, doc.y).strokeColor(BRAND_COLOR).lineWidth(1).stroke();
  doc.moveDown(0.5);
  doc.fontSize(9).font('Helvetica').fillColor(MUTED_COLOR).text(
    'This summary is for your reference. If you have questions or concerns, please contact your provider.',
    { align: 'center' },
  );
  if (clinic?.phone) {
    doc.text(`Questions? Call us at ${formatPhone(clinic.phone)}`, { align: 'center' });
  }
  doc.moveDown(0.5);
  doc.fontSize(8).fillColor('#94a3b8').text(
    `${clinic?.name || data.clinicName} | Generated ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
    { align: 'center' },
  );
  if (clinic?.npi) {
    doc.text(`NPI: ${clinic.npi}`, { align: 'center' });
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

function parseSummary(summary: string): Array<{ title: string; content: string }> {
  const sections: Array<{ title: string; content: string }> = [];
  const lines = summary.split('\n');
  let currentTitle = '';
  let currentContent: string[] = [];

  const sectionTitles = [
    'WHAT WE TALKED ABOUT',
    'WHAT WE FOUND',
    'YOUR DIAGNOSIS',
    'YOUR TREATMENT PLAN',
    'WHEN TO CALL US',
    'FOLLOW-UP',
  ];

  for (const line of lines) {
    const trimmed = line.trim();
    const matchedTitle = sectionTitles.find(
      (t) => trimmed.toUpperCase().startsWith(t) || trimmed.toUpperCase().replace(/[:\-—]/g, '').trim() === t,
    );

    if (matchedTitle) {
      if (currentTitle && currentContent.length) {
        sections.push({ title: currentTitle, content: currentContent.join('\n').trim() });
      }
      currentTitle = matchedTitle;
      // Check if content is on the same line after a colon/dash
      const afterTitle = trimmed.slice(matchedTitle.length).replace(/^[:\-—\s]+/, '').trim();
      currentContent = afterTitle ? [afterTitle] : [];
    } else if (currentTitle && trimmed) {
      currentContent.push(trimmed);
    }
  }

  if (currentTitle && currentContent.length) {
    sections.push({ title: currentTitle, content: currentContent.join('\n').trim() });
  }

  // If no sections found, treat entire summary as a single block
  if (sections.length === 0 && summary.trim()) {
    sections.push({ title: 'YOUR VISIT SUMMARY', content: summary.trim() });
  }

  return sections;
}

function estimateTextHeight(doc: PDFKit.PDFDocument, text: string, width: number): number {
  const lineHeight = 14;
  const avgCharsPerLine = width / 6;
  const lines = Math.ceil(text.length / avgCharsPerLine);
  return lines * lineHeight;
}
