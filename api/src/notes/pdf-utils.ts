import QRCode from 'qrcode';
import https from 'https';
import http from 'http';

export const COLORS = {
  brand: '#0f766e',
  brandLight: '#14b8a6',
  text: '#0f172a',
  textSecondary: '#475569',
  muted: '#64748b',
  border: '#e2e8f0',
  surface: '#f8fafc',
  surfaceMuted: '#f1f5f9',
  white: '#ffffff',
  warning: '#f59e0b',
  warningBg: '#fef3c7',
  warningText: '#92400e',
  success: '#10b981',
  successBg: '#ecfdf5',
  successText: '#166534',
  danger: '#ef4444',
  dangerBg: '#fef2f2',
};

export interface ClinicInfo {
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

export interface ClinicianInfo {
  name: string;
  credentials?: string;
  title?: string;
  specialty?: string;
  individualNpi?: string;
  signatureImageUrl?: string;
}

export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

export function formatAddress(clinic: ClinicInfo): string {
  return [clinic.addressStreet, clinic.addressCity, clinic.addressState, clinic.addressZip]
    .filter(Boolean)
    .join(', ');
}

export function formatContactLine(clinic: ClinicInfo): string {
  const parts: string[] = [];
  if (clinic.phone) parts.push(`Tel: ${formatPhone(clinic.phone)}`);
  if (clinic.fax) parts.push(`Fax: ${formatPhone(clinic.fax)}`);
  return parts.join('  |  ');
}

export function formatProviderName(clinician: ClinicianInfo): string {
  return clinician.credentials
    ? `${clinician.name}, ${clinician.credentials}`
    : clinician.name;
}

export async function generateQRCode(data: string, size = 80): Promise<Buffer> {
  return QRCode.toBuffer(data, {
    width: size,
    margin: 1,
    color: { dark: COLORS.text, light: '#ffffff' },
  });
}

export async function fetchImage(url: string): Promise<Buffer | null> {
  if (!url) return null;

  return new Promise((resolve) => {
    const protocol = url.startsWith('https') ? https : http;
    const timeout = setTimeout(() => resolve(null), 5000);

    protocol.get(url, (res) => {
      if (res.statusCode !== 200) {
        clearTimeout(timeout);
        resolve(null);
        return;
      }

      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        clearTimeout(timeout);
        resolve(Buffer.concat(chunks));
      });
      res.on('error', () => {
        clearTimeout(timeout);
        resolve(null);
      });
    }).on('error', () => {
      clearTimeout(timeout);
      resolve(null);
    });
  });
}

export function addPageNumbers(doc: PDFKit.PDFDocument): void {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.fontSize(9).fillColor(COLORS.muted).text(
      `Page ${i + 1} of ${range.count}`,
      54,
      doc.page.height - 40,
      { align: 'center', width: doc.page.width - 108 },
    );
  }
}

export function drawHorizontalRule(
  doc: PDFKit.PDFDocument,
  y: number,
  color = COLORS.brand,
  width = 2,
  leftMargin = 54,
  rightMargin = 54,
): void {
  const pageWidth = doc.page.width;
  doc.moveTo(leftMargin, y)
    .lineTo(pageWidth - rightMargin, y)
    .strokeColor(color)
    .lineWidth(width)
    .stroke();
}

export function drawBox(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  height: number,
  options: { fill?: string; stroke?: string; strokeWidth?: number } = {},
): void {
  const { fill, stroke, strokeWidth = 1 } = options;

  if (fill) {
    doc.rect(x, y, width, height).fillColor(fill).fill();
  }
  if (stroke) {
    doc.rect(x, y, width, height).strokeColor(stroke).lineWidth(strokeWidth).stroke();
  }
}

export function estimateTextHeight(doc: PDFKit.PDFDocument, text: string, width: number): number {
  const lineHeight = 14;
  const avgCharsPerLine = width / 6;
  const lines = Math.ceil(text.length / avgCharsPerLine);
  return lines * lineHeight;
}

export function addConfidentialityFooter(doc: PDFKit.PDFDocument, text = 'CONFIDENTIAL MEDICAL DOCUMENT'): void {
  const y = doc.page.height - 30;
  doc.fontSize(8).fillColor(COLORS.muted).text(text, 54, y, {
    align: 'center',
    width: doc.page.width - 108,
  });
}

export function sanitizeTextForPdf(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/—/g, '-')
    .replace(/–/g, '-')
    .replace(/•/g, '-')
    .replace(/…/g, '...')
    .replace(/[✓✔✕✖✗✘]/g, '*')
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
    .replace(/[\u{2600}-\u{26FF}]/gu, '')
    .replace(/[\u{2700}-\u{27BF}]/gu, '');
}
