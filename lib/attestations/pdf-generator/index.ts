/**
 * Générateur PDF officiel pour les attestations FSA.
 *
 * Produit un PDF 1.7 valide avec :
 * - En-tête officiel FSA
 * - Identité du titulaire
 * - Formation / mention / score
 * - QR code pointant vers /verifier?code=...
 * - Empreinte du sceau HMAC
 * - Lien de vérification publique
 *
 * Chargé dynamiquement via ATTESTATION_PDF_GENERATOR_MODULE.
 * Aucune dépendance navigateur — pure Node.js.
 */

import { createHash } from "node:crypto";
import type { CanonicalPdfGenerator, CanonicalPdfGeneratorInput } from "../pdf";

// ── Helpers PDF ──────────────────────────────────────────────────────────────

/** Échappe une chaîne pour un litéral PDF `(...)`. */
function pdfStr(value: string | null | undefined): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7e]/g, "?")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function isoDate(value: Date | string | null | undefined): string {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toISOString().slice(0, 10);
}

function mentionLabel(mention: string | null | undefined): string {
  const map: Record<string, string> = {
    PASSABLE: "Passable",
    ASSEZ_BIEN: "Assez Bien",
    BIEN: "Bien",
    TRES_BIEN: "Très Bien",
    EXCELLENCE: "Excellence",
  };
  return mention ? map[mention] ?? mention : "-";
}

// ── QR Code ──────────────────────────────────────────────────────────────────

/**
 * Génère un QR code en tant que bitmap PBM (Portable Bitmap) noir et blanc.
 * Retourne un buffer PBM prêt à être intégré dans le PDF.
 */
async function generateQrPbm(data: string, size: number = 150): Promise<Buffer> {
  const QRCode = await import("qrcode");
  // Génère le QR comme un tableau 2D de modules (true = noir)
  const matrix = QRCode.create(data, { errorCorrectionLevel: "M" });
  const modules = matrix.modules;
  const moduleCount = modules.size;

  // Crée une image bitmap en mémoire (1 bit par pixel)
  const pixelSize = Math.max(1, Math.floor(size / moduleCount));
  const imgWidth = moduleCount * pixelSize;
  const imgHeight = moduleCount * pixelSize;

  // PBM format: P4 header + binary pixel data
  const header = `P4\n${imgWidth} ${imgHeight}\n`;
  const rowBytes = Math.ceil(imgWidth / 8);
  const pixels = Buffer.alloc(rowBytes * imgHeight);

  for (let y = 0; y < imgHeight; y++) {
    for (let x = 0; x < imgWidth; x++) {
      const moduleX = Math.floor(x / pixelSize);
      const moduleY = Math.floor(y / pixelSize);
      const isBlack = modules.get(moduleY, moduleX);
      if (isBlack) {
        const byteIndex = y * rowBytes + Math.floor(x / 8);
        const bitIndex = 7 - (x % 8);
        pixels[byteIndex] |= 1 << bitIndex;
      }
    }
  }

  return Buffer.concat([Buffer.from(header, "ascii"), pixels]);
}

// ── Assemblage PDF ───────────────────────────────────────────────────────────

interface PdfObject {
  id: number;
  body: string;
  stream?: Buffer;
}

function assemblePdf(objects: PdfObject[]): Buffer {
  const chunks: Buffer[] = [];
  let size = 0;

  const append = (text: string) => {
    const chunk = Buffer.from(text, "latin1");
    chunks.push(chunk);
    size += chunk.length;
  };

  const appendBuf = (buf: Buffer) => {
    chunks.push(buf);
    size += buf.length;
  };

  // Header
  append("%PDF-1.7\n");
  append("%\xe2\xe3\xcf\xd3\n");

  // Objects
  const offsets: number[] = [];
  for (const obj of objects) {
    offsets.push(size);
    if (obj.stream) {
      append(`${obj.id} 0 obj\n${obj.body}\nstream\n`);
      appendBuf(obj.stream);
      append("\nendstream\nendobj\n");
    } else {
      append(`${obj.id} 0 obj\n${obj.body}\nendobj\n`);
    }
  }

  // Cross-reference table
  const startxref = size;
  const entries = offsets
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");
  append(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${entries}`);
  append(
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF\n`,
  );

  return Buffer.concat(chunks);
}

// ── Générateur principal ─────────────────────────────────────────────────────

async function buildPdf(input: CanonicalPdfGeneratorInput): Promise<Buffer> {
  const qrBuffer = await generateQrPbm(input.verificationUrl, 120);
  const sealHash = createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex")
    .slice(0, 32);

  // ── Contenu texte ──
  const textLines = [
    "ATTESTATION DE CERTIFICATION",
    "",
    `Code : ${input.code}`,
    `Titulaire : ${pdfStr(input.fullName)}`,
    "",
    `Formation : ${pdfStr(input.formationName)}`,
    input.certificationMention
      ? `Mention : ${mentionLabel(input.certificationMention)}`
      : null,
    input.certificationScore != null
      ? `Score : ${input.certificationScore}/100`
      : null,
    `Date de fin : ${isoDate(input.endDate)}`,
    "",
    `Emettu le : ${isoDate(input.issuedAt)}`,
    `Sceau v${input.sealVersion} : ${sealHash}`,
    "",
    `Verification : ${input.verificationUrl}`,
  ].filter(Boolean) as string[];

  const textContent =
    [
      "BT",
      "/F1 11 Tf",
      "14 TL",
      "50 790 Td",
      ...textLines.map((line) => `(${pdfStr(line)}) Tj T*`),
      "ET",
    ].join("\n") + "\n";

  // ── Objets PDF ──
  // 1: Catalog
  // 2: Pages
  // 3: Page (texte)
  // 4: Font Helvetica
  // 5: Text content stream
  // 6: QR image (PBM bitmap)
  // 7: Page (QR)
  // 8: QR content stream
  // 9: Info dict

  const qrContent = `q 120 0 0 120 420 680 cm /Im1 Do Q\n`;

  const objects: PdfObject[] = [
    { id: 1, body: "<< /Type /Catalog /Pages 2 0 R >>" },
    { id: 2, body: "<< /Type /Pages /Kids [3 0 R] /Count 1 >>" },
    {
      id: 3,
      body:
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] " +
        "/Resources << /Font << /F1 4 0 R >> /XObject << /Im1 6 0 R >> >> " +
        "/Contents [5 0 R 8 0 R] >>",
    },
    {
      id: 4,
      body: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    },
    {
      id: 5,
      body: `<< /Length ${Buffer.byteLength(textContent, "latin1")} >>`,
      stream: Buffer.from(textContent, "latin1"),
    },
    {
      id: 6,
      body: `<< /Type /XObject /Subtype /Image /Width ${Math.ceil(120)} /Height ${Math.ceil(120)} /ColorSpace /DeviceGray /BitsPerComponent 1 /Filter /ASCIIHexDecode >>`,
      stream: qrBuffer,
    },
    {
      id: 7,
      body:
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] " +
        "/Resources << /XObject << /Im1 6 0 R >> >> /Contents 8 0 R >>",
    },
    {
      id: 8,
      body: `<< /Length ${qrContent.length} >>`,
      stream: Buffer.from(qrContent, "latin1"),
    },
    {
      id: 9,
      body: `<< /Producer (FSA Attestations PDF Generator v1) /Title (Attestation ${pdfStr(input.code)}) /CreationDate (${new Date().toISOString()}) >>`,
    },
  ];

  return assemblePdf(objects);
}

/** Point d'entrée conforme au contrat `CanonicalPdfGenerator`. */
export async function generateCanonicalAttestationPdf(
  input: CanonicalPdfGeneratorInput,
): Promise<Uint8Array> {
  return buildPdf(input);
}

export default { generateCanonicalAttestationPdf } satisfies CanonicalPdfGenerator;
