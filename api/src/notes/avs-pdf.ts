import PDFDocument from 'pdfkit';
import {
  COLORS,
  type ClinicInfo,
  type ClinicianInfo,
  formatPhone,
  formatAddress,
  formatContactLine,
  formatProviderName,
  generateQRCode,
  fetchImage,
  drawHorizontalRule,
  drawBox,
  estimateTextHeight,
} from './pdf-utils';

interface AvsData {
  patientName: string;
  patientDob: string;
  visitDate: string;
  clinicName: string;
  clinicianName: string;
  summary: string;
  clinic?: ClinicInfo;
  clinician?: ClinicianInfo;
  patientPortalUrl?: string;
}

const SECTION_ICONS: Record<string, string> = {
  'WHAT WE TALKED ABOUT': '',
  'WHAT WE FOUND': '',
  'YOUR DIAGNOSIS': '',
  'YOUR TREATMENT PLAN': '',
  'WHEN TO CALL US': '',
  'FOLLOW-UP': '',
  'YOUR VISIT SUMMARY': '',
};

export async function buildAvsPdf(data: AvsData): Promise<PDFKit.PDFDocument> {
  const doc = new PDFDocument({
    size: 'LETTER',
    margins: { top: 50, bottom: 60, left: 54, right: 54 },
    bufferPages: true,
  });

  const clinic = data.clinic;
  const clinician = data.clinician;
  const pageWidth = doc.page.width;
  const contentWidth = pageWidth - 108;

  // Fetch logo and QR code in parallel
  const [logoBuffer, qrBuffer] = await Promise.all([
    clinic?.logoUrl ? fetchImage(clinic.logoUrl) : Promise.resolve(null),
    data.patientPortalUrl ? generateQRCode(data.patientPortalUrl, 60) : Promise.resolve(null),
  ]);

  // Header with clinic branding
  let headerY = 50;

  if (logoBuffer) {
    try {
      doc.image(logoBuffer, 54, headerY, { width: 50, height: 50 });
      doc.fontSize(20).font('Helvetica-Bold').fillColor(COLORS.brand)
        .text(clinic?.name || data.clinicName, 114, headerY + 10);
      if (clinic?.addressStreet) {
        doc.fontSize(9).font('Helvetica').fillColor(COLORS.muted)
          .text(formatAddress(clinic), 114, headerY + 32);
      }
      headerY += 60;
    } catch {
      // If logo fails to render, fall back to text-only header
      doc.fontSize(22).font('Helvetica-Bold').fillColor(COLORS.brand)
        .text(clinic?.name || data.clinicName, { align: 'center' });
      headerY = doc.y + 5;
    }
  } else {
    doc.fontSize(22).font('Helvetica-Bold').fillColor(COLORS.brand)
      .text(clinic?.name || data.clinicName, { align: 'center' });
    headerY = doc.y + 5;
  }

  // Clinic contact info
  if (clinic?.addressStreet && !logoBuffer) {
    doc.fontSize(10).font('Helvetica').fillColor(COLORS.muted)
      .text(formatAddress(clinic), { align: 'center' });
  }
  if (clinic?.phone || clinic?.fax) {
    doc.fontSize(10).font('Helvetica').fillColor(COLORS.muted)
      .text(formatContactLine(clinic), { align: 'center' });
  }
  doc.moveDown(0.3);

  // Title
  doc.fontSize(16).font('Helvetica-Bold').fillColor(COLORS.brand)
    .text('AFTER-VISIT SUMMARY', { align: 'center' });
  doc.moveDown(0.4);

  // Decorative line
  drawHorizontalRule(doc, doc.y, COLORS.brand, 2);
  doc.moveDown(0.75);

  // Patient info box
  const boxTop = doc.y;
  const boxHeight = 70;
  drawBox(doc, 54, boxTop, contentWidth, boxHeight, { fill: COLORS.surface, stroke: COLORS.border });

  doc.y = boxTop + 14;
  doc.x = 70;
  doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.text)
    .text('Patient: ', { continued: true }).font('Helvetica').text(data.patientName);
  doc.x = 70;
  doc.font('Helvetica-Bold').text('Date of Birth: ', { continued: true }).font('Helvetica').text(data.patientDob);

  doc.y = boxTop + 14;
  doc.x = 320;
  doc.font('Helvetica-Bold').text('Visit Date: ', { continued: true }).font('Helvetica').text(data.visitDate);
  doc.x = 320;
  const providerDisplay = formatProviderName(clinician || { name: data.clinicianName });
  doc.font('Helvetica-Bold').text('Provider: ', { continued: true }).font('Helvetica').text(providerDisplay);
  if (clinician?.specialty) {
    doc.x = 320;
    doc.fontSize(10).font('Helvetica').fillColor(COLORS.muted).text(clinician.specialty);
  }

  // QR code in top right of patient box
  if (qrBuffer) {
    try {
      doc.image(qrBuffer, pageWidth - 54 - 60, boxTop + 5, { width: 50 });
    } catch {
      // Silently fail if QR code can't be rendered
    }
  }

  doc.x = 54;
  doc.y = boxTop + boxHeight + 15;
  doc.fillColor(COLORS.text);

  // Parse and render sections
  const sections = parseSummary(data.summary);

  for (const section of sections) {
    if (section.title === 'WHEN TO CALL US') {
      // Alert box for critical warnings
      doc.moveDown(0.5);
      const alertTop = doc.y;
      const alertHeight = estimateTextHeight(doc, section.content, contentWidth - 30) + 50;

      drawBox(doc, 54, alertTop, contentWidth, alertHeight, { fill: COLORS.warningBg });
      drawBox(doc, 54, alertTop, 4, alertHeight, { fill: COLORS.warning });

      doc.y = alertTop + 12;
      doc.x = 70;
      doc.fontSize(12).font('Helvetica-Bold').fillColor(COLORS.warningText)
        .text(section.title);
      doc.x = 70;
      doc.moveDown(0.3);
      doc.fontSize(11).font('Helvetica').fillColor(COLORS.text)
        .text(section.content, { width: contentWidth - 30 });

      doc.y = alertTop + alertHeight + 12;
      doc.x = 54;
    } else {
      doc.moveDown(0.75);
      doc.fontSize(12).font('Helvetica-Bold').fillColor(COLORS.brand)
        .text(section.title);
      doc.moveDown(0.25);

      // Format content - handle bullet points
      const lines = section.content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*')) {
          doc.fontSize(11).font('Helvetica').fillColor(COLORS.text)
            .text(`  ${trimmed}`, { width: contentWidth, indent: 10 });
        } else if (trimmed) {
          doc.fontSize(11).font('Helvetica').fillColor(COLORS.text)
            .text(trimmed, { width: contentWidth });
        }
      }
    }
  }

  // Footer
  doc.moveDown(1.5);
  drawHorizontalRule(doc, doc.y, COLORS.border, 1);
  doc.moveDown(0.5);

  doc.fontSize(9).font('Helvetica').fillColor(COLORS.muted).text(
    'This summary is for your reference. If you have questions or concerns, please contact your provider.',
    { align: 'center' },
  );
  if (clinic?.phone) {
    doc.text(`Questions? Call us at ${formatPhone(clinic.phone)}`, { align: 'center' });
  }
  doc.moveDown(0.5);
  doc.fontSize(8).fillColor(COLORS.muted).text(
    `${clinic?.name || data.clinicName} | Generated ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
    { align: 'center' },
  );
  if (clinic?.npi) {
    doc.text(`NPI: ${clinic.npi}`, { align: 'center' });
  }

  return doc;
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
      const afterTitle = trimmed.slice(matchedTitle.length).replace(/^[:\-—\s]+/, '').trim();
      currentContent = afterTitle ? [afterTitle] : [];
    } else if (currentTitle && trimmed) {
      currentContent.push(trimmed);
    }
  }

  if (currentTitle && currentContent.length) {
    sections.push({ title: currentTitle, content: currentContent.join('\n').trim() });
  }

  if (sections.length === 0 && summary.trim()) {
    sections.push({ title: 'YOUR VISIT SUMMARY', content: summary.trim() });
  }

  return sections;
}
