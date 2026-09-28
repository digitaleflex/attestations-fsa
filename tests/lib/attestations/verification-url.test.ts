import { describe, expect, it, vi, afterEach } from "vitest";
import {
  attestationVerificationPath,
  attestationVerificationUrl,
  isAttestationCode,
  officialPdfDownloadPath,
  OFFICIAL_PDF_PATH,
  VERIFICATION_PATH,
} from "@/lib/attestations/verification-url";
import {
  isOfficialPdfDownloadable,
  startOfficialPdfDownload,
} from "@/lib/attestations/client-download";

const CODE = "FSA-2026-M09-00001-abcde";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("lib/attestations/verification-url — cible unique du QR (#258)", () => {
  it("n'accepte que les codes d'attestation", () => {
    expect(isAttestationCode(CODE)).toBe(true);
    expect(isAttestationCode("../../etc/passwd")).toBe(false);
    expect(isAttestationCode("autre-code")).toBe(false);
    expect(isAttestationCode(null)).toBe(false);
  });

  it("encode le code en query string sur la route publique", () => {
    expect(attestationVerificationPath(CODE)).toBe(`${VERIFICATION_PATH}?code=${encodeURIComponent(CODE)}`);
    expect(officialPdfDownloadPath(CODE)).toBe(`${OFFICIAL_PDF_PATH}?code=${encodeURIComponent(CODE)}`);
  });

  it("refuse un code inexploitable plutôt que de produire une URL ambiguë", () => {
    expect(() => attestationVerificationPath("pas un code")).toThrow(/Code d'attestation invalide/);
    expect(() => officialPdfDownloadPath("FSA-2026/../../secret")).toThrow(/Code d'attestation invalide/);
  });

  it("grave une URL absolue pour le QR du PDF serveur", () => {
    expect(attestationVerificationUrl("https://fsa.example/", CODE)).toBe(
      `https://fsa.example${VERIFICATION_PATH}?code=${encodeURIComponent(CODE)}`,
    );
    expect(attestationVerificationUrl("https://fsa.example", CODE)).toBe(
      `https://fsa.example${VERIFICATION_PATH}?code=${encodeURIComponent(CODE)}`,
    );
  });

  it("refuse une base non absolue : le QR du document resterait inerte", () => {
    expect(() => attestationVerificationUrl("/relative", CODE)).toThrow(/URL absolue/);
    expect(() => attestationVerificationUrl("fsa.example", CODE)).toThrow(/URL absolue/);
  });
});

describe("lib/attestations/client-download — téléchargement navigateur", () => {
  it("n'autorise que les statuts publiables", () => {
    expect(isOfficialPdfDownloadable("VALIDATED")).toBe(true);
    expect(isOfficialPdfDownloadable("CLAIMED")).toBe(true);
    expect(isOfficialPdfDownloadable("PENDING")).toBe(false);
    expect(isOfficialPdfDownloadable("REJECTED")).toBe(false);
    expect(isOfficialPdfDownloadable(undefined)).toBe(false);
  });

  it("suit la redirection serveur dans un nouvel onglet (bucket privé, sans CORS)", () => {
    const open = vi.fn().mockReturnValue({} as Window);
    vi.stubGlobal("window", { open });

    expect(startOfficialPdfDownload(CODE)).toBe(true);
    expect(open).toHaveBeenCalledWith(officialPdfDownloadPath(CODE), "_blank", "noopener,noreferrer");
  });

  it("signale un code invalide et un pop-up bloqué sans autoría réseau", () => {
    vi.stubGlobal("window", { open: vi.fn().mockReturnValue(null) });
    expect(startOfficialPdfDownload("nope")).toBe(false);
    expect(startOfficialPdfDownload(CODE)).toBe(false);
  });
});
