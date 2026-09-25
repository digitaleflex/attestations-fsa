/**
 * Fixture E2E — générateur PDF « test » du flux d'émission (#258).
 *
 * POURQUOI CE FICHIER EXISTE
 * Le flux applicatif n'émet une attestation CERTIFICATION que si un générateur
 * PDF **serveur** est configuré (`ATTESTATION_PDF_GENERATOR_MODULE`, voir
 * `lib/attestations/pdf.ts`) : sans lui, `issueExamAttestation` bloque
 * volontairement l'émission (mieux vaut aucune attestation qu'un document non
 * probant). La suite E2E doit donc fournir un générateur — mais un générateur
 * qui n'imite pas la production : ce module produit un PDF minimal **réellement
 * valide** (en-tête, objets, table xref calculée, trailer, `%%EOF`) et ne
 * prétend à aucune mise en page, aucun QR, aucun sceau.
 *
 * CE QUE LA SUITE PROUVE QUAND MÊME
 * Toute la chaîne réelle reste exercée de bout en bout : chargement du module
 * via la variable d'environnement, contrôle de la signature `%PDF-`, écriture
 * dans le stockage objet, `pdfKey`/`pdfHash`/`pdfVersion`/`pdfGeneratedAt`
 * persistés, scellement HMAC, lecture par `/api/verifier` et redirection 307
 * vers l'URL signée. Seul le rendu graphique du document est une fixture.
 *
 * DOUBLE GARDE « TEST ONLY »
 * Ce module refuse de produire quoi que ce soit s'il n'est pas explicitement
 * armé par la suite E2E (`E2E_TEST_PDF_GENERATOR=1`, posé uniquement dans
 * `playwright.config.ts`) ou si `NODE_ENV=production`. Un déploiement ne peut
 * donc pas transformer cette fixture en document officiel : il lui faudrait
 * poser deux variables Envoyées à la main, contre sa propre documentation.
 *
 * Format : module ESM autonome (`.mjs`) car il est chargé par Node via
 * `import(pathToFileURL(...))` à l'exécution — un `.ts` ne serait pas
 * importable tel quel. Aucune dépendance : le PDF est assemblé octet par
 * octet, donc déterministe pour un même `input`.
 */

/** Variable d'environnement qui arme cette fixture (jamais posée en prod). */
const MARKER_ENV = "E2E_TEST_PDF_GENERATOR";

/**
 * Refus hors contexte de test. Un échec bruyant est préférable à un PDF
 * « test » stocké et scellé comme s'il était un document officiel.
 */
function assertTestOnlyContext() {
  if (process.env[MARKER_ENV] !== "1") {
    throw new Error(
      `Fixture PDF E2E : ${MARKER_ENV}=1 est requis. ` +
        "Ce module est réservé à la suite Playwright et ne doit jamais être " +
        "déclaré dans ATTESTATION_PDF_GENERATOR_MODULE d'un déploiement.",
    );
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Fixture PDF E2E : génération refusée en production (NODE_ENV=production).",
    );
  }
}

/**
 * Rend une valeur sûre dans une chaîne littérale PDF (`(...)`) : ASCII
 * imprimable seulement, parenthèses et antislash échappés. Les accents sont
 * ramenés à leur base ASCII et tout caractère hors WinAnsi devient « ? » —
 * un document de test n'a aucune raison de casser sur un nom exotique.
 */
function pdfString(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7e]/g, "?")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function isoDate(value) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toISOString().slice(0, 10);
}

/**
 * Assemble un PDF 1.7 d'une page à partir des corps d'objets, en calculant
 * les décalages réels de la table xref (un PDF à xref faux est considéré
 * comme corrompu par les lecteurs).
 */
function assemblePdf(bodies) {
  const chunks = [];
  let size = 0;
  const append = (text) => {
    const chunk = Buffer.from(text, "latin1");
    chunks.push(chunk);
    size += chunk.length;
  };

  append("%PDF-1.7\n");
  // Marqueur binaire : empêche les outils de transfert de re-encoder le
  // fichier en changeant les octets (et donc son SHA-256).
  append("%\xe2\xe3\xcf\xd3\n");

  const offsets = [];
  bodies.forEach((body, index) => {
    offsets.push(size);
    append(`${index + 1} 0 obj\n${body}\nendobj\n`);
  });

  const startxref = size;
  const entries = offsets
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");
  append(`xref\n0 ${bodies.length + 1}\n0000000000 65535 f \n${entries}`);
  append(
    `trailer\n<< /Size ${bodies.length + 1} /Root 1 0 R >>\n` +
      `startxref\n${startxref}\n%%EOF\n`,
  );

  return Buffer.concat(chunks);
}

/**
 * Contrat attendu par `lib/attestations/pdf.ts` :
 * `generateCanonicalAttestationPdf(input) => Promise<Uint8Array | Buffer>`.
 *
 * @param {Record<string, unknown>} input Snapshot du document (`code`,
 *   `fullName`, `pdfVersion`, `verificationUrl`…).
 * @returns {Promise<Buffer>} Un PDF minimal valide.
 */
export async function generateCanonicalAttestationPdf(input) {
  assertTestOnlyContext();

  const lines = [
    "ATTESTATION DE CERTIFICATION FSA - DOCUMENT DE TEST E2E",
    "Ce document est une fixture de test : il ne fait pas foi.",
    "",
    `Code: ${input.code}`,
    `Titulaire: ${input.fullName}`,
    `Formation: ${input.formationName ?? "-"}`,
    `Mention: ${input.certificationMention ?? "-"}`,
    `Score certification: ${input.certificationScore ?? "-"}`,
    `Date de fin: ${isoDate(input.endDate)}`,
    `Version du PDF: v${input.pdfVersion}`,
    `Verification: ${input.verificationUrl}`,
  ].map((line) => pdfString(line));

  const content =
    ["BT", "/F1 10 Tf", "15 TL", "48 780 Td", ...lines.map((line) => `(${line}) Tj T*`), "ET"].join(
      "\n",
    ) + "\n";

  return assemblePdf([
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] " +
      "/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    `<< /Length ${content.length} >>\nstream\n${content}endstream`,
    `<< /Producer (FSA E2E test PDF fixture) /Title (Code ${pdfString(input.code)}) >>`,
  ]);
}

export default { generateCanonicalAttestationPdf };
