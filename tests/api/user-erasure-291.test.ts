/**
 * #291 — Effacement de compte traçable et non destructif pour les preuves.
 *
 * Contrat vérifié ici :
 *  - l'effacement est tracé : une ligne d'audit `ACCOUNT_ANONYMIZED` est
 *    écrite, dans la MÊME transaction que l'effacement, avec l'avant/après,
 *    l'identité de l'admin et l'identité du compte concerné ;
 *  - le compte est ANONYMISÉ, jamais supprimé : `user.delete` n'est jamais
 *    appelé et la ligne `User` survit (clé étrangère de `ExamSession`,
 *    `AuditLog`, `CorrectionRequest` et `Reclamation`, toutes en RESTRICT) ;
 *  - les attestations, PDF, hash et sceaux sont intacts : l'effacement ne
 *    touche à aucune attestation, et le compte reste rattaché à son
 *    `userId` pour que la preuve reste vérifiable ;
 *  - les sessions d'examen et leurs réponses survivent ;
 *  - les sessions vivantes sont révoquées via la source unique déjà éprouvée
 *    (`revokeUserSessions`), et les credentials sont purgés (Account,
 *    TwoFactor, mot de passe, vérifications d'e-mail) : plus rien pour se
 *    reconnecter ;
 *  - le compte devient inutilisable : `status = BLOCKED` + `banned = true`.
 */
import { vi, describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const db = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
  userCount: vi.fn(),
  attestationCount: vi.fn(),
  examSessionCount: vi.fn(),
  accountDeleteMany: vi.fn(),
  twoFactorDeleteMany: vi.fn(),
  verificationDeleteMany: vi.fn(),
  userDelete: vi.fn(),
  $transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: db.$transaction,
    user: {
      findUnique: db.userFindUnique,
      update: db.userUpdate,
      count: db.userCount,
      delete: db.userDelete,
    },
    attestation: { count: db.attestationCount },
    examSession: { count: db.examSessionCount },
    account: { deleteMany: db.accountDeleteMany },
    twoFactor: { deleteMany: db.twoFactorDeleteMany },
    verification: { deleteMany: db.verificationDeleteMany },
  },
}));

const deps = vi.hoisted(() => ({
  getAdminUser: vi.fn(),
  createAuditLog: vi.fn(),
  revokeUserSessions: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAdminUser: deps.getAdminUser }));
vi.mock("@/lib/audit", () => ({ createAuditLog: deps.createAuditLog }));
vi.mock("@/lib/account-status", () => ({
  revokeUserSessions: deps.revokeUserSessions,
}));

import { DELETE } from "../../app/api/users/[id]/route";
import { makeRequest } from "../helpers/request";

/** Compte candidat porteur d'une attestation officielle et d'une session. */
function makeTarget(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-1",
    name: "Awa Diallo",
    email: "awa.diallo@exemple.test",
    role: "user",
    status: "ACTIVE",
    banned: false,
    phone: "+229 90 00 00 00",
    examId: "exam-1",
    ...overrides,
  };
}

function callDelete(body: unknown = undefined, headers: Record<string, string> = {}) {
  return DELETE(makeRequest(body, headers), { params: Promise.resolve({ id: "user-1" }) });
}

beforeEach(() => {
  vi.clearAllMocks();

  deps.getAdminUser.mockResolvedValue({
    id: "admin-1",
    name: "Admin FSA",
    role: "admin",
  } as never);
  deps.createAuditLog.mockResolvedValue(undefined as never);
  deps.revokeUserSessions.mockResolvedValue(2 as never);
  deps.createAuditLog.mockClear();

  db.userFindUnique.mockResolvedValue(makeTarget() as never);
  db.userCount.mockResolvedValue(1 as never);
  db.attestationCount.mockResolvedValue(3 as never);
  db.examSessionCount.mockResolvedValue(2 as never);
  db.accountDeleteMany.mockResolvedValue({ count: 1 } as never);
  db.twoFactorDeleteMany.mockResolvedValue({ count: 1 } as never);
  db.verificationDeleteMany.mockResolvedValue({ count: 2 } as never);
  db.userUpdate.mockResolvedValue(makeTarget({ email: null }) as never);

  // Le client Prisma étendu n'est pas généré au moment du test : on rejoue
  // la transaction interactive en donnant au callback le même jeu de mocks.
  db.$transaction.mockImplementation((callback: (tx: unknown) => unknown) =>
    callback({
      user: {
        findUnique: db.userFindUnique,
        update: db.userUpdate,
        count: db.userCount,
        delete: db.userDelete,
      },
      attestation: { count: db.attestationCount },
      examSession: { count: db.examSessionCount },
      account: { deleteMany: db.accountDeleteMany },
      twoFactor: { deleteMany: db.twoFactorDeleteMany },
      verification: { deleteMany: db.verificationDeleteMany },
    }),
  );
});

/**
 * Retire les commentaires pour que la garde statique porte sur le CODE
 * exécuté : la route documente précisément pourquoi elle n'appelle pas
 * `user.delete`, et cette documentation ne doit pas faire échouer le test.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

describe("DELETE /api/users/[id] — effacement de compte (#291)", () => {
  it("401 si l'appelant n'est pas administrateur", async () => {
    deps.getAdminUser.mockResolvedValue(null as never);
    const res = await callDelete();
    expect(res.status).toBe(401);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("404 si le compte n'existe pas, sans aucune écriture", async () => {
    db.userFindUnique.mockResolvedValue(null as never);
    const res = await callDelete();
    expect(res.status).toBe(404);
    expect(db.userUpdate).not.toHaveBeenCalled();
    expect(deps.createAuditLog).not.toHaveBeenCalled();
  });

  it("l'effacement est tracé : une ligne d'audit ACCOUNT_ANONYMIZED est écrite", async () => {
    const res = await callDelete({ reason: "Demande d'effacement du titulaire" });
    expect(res.status).toBe(200);
    expect(deps.createAuditLog).toHaveBeenCalledTimes(1);

    const [entry, tx] = deps.createAuditLog.mock.calls[0] as [
      Record<string, unknown>,
      unknown,
    ];
    expect(entry).toMatchObject({
      action: "ACCOUNT_ANONYMIZED",
      resource: "USER",
      resourceId: "user-1",
      ipAddress: "unknown",
    });
    // L'auteur de la trace est l'ADMIN (clé étrangère valide), jamais le
    // compte effacé ; le compte concerné est identifié en clair.
    expect(entry.userId).toBe("admin-1");
    expect(entry.oldValue).toMatchObject({ subjectUserId: "user-1" });
    expect(entry.newValue).toMatchObject({
      subjectUserId: "user-1",
      adminId: "admin-1",
      anonymized: true,
      physicalDelete: false,
      reason: "Demande d'effacement du titulaire",
    });
    // La trace est écrite DANS la transaction de l'effacement.
    expect(tx).toBeDefined();
  });

  it("la ligne d'audit porte l'avant ET l'après de l'effacement", async () => {
    await callDelete();
    const [entry] = deps.createAuditLog.mock.calls[0] as [Record<string, unknown>];
    expect(entry.oldValue).toMatchObject({
      name: "Awa Diallo",
      email: "awa.diallo@exemple.test",
      role: "user",
      status: "ACTIVE",
      banned: false,
    });
    expect(entry.newValue).toMatchObject({
      anonymizedFields: expect.arrayContaining([
        "name",
        "email",
        "password",
        "phone",
        "address",
        "birthDate",
        "birthPlace",
        "status",
        "banned",
      ]),
      purged: { sessions: 2, accounts: 1, twoFactors: 1, emailVerifications: 2 },
      preserved: { attestations: 3, examSessions: 2 },
    });
  });

  it("le compte est ANONYMISÉ, jamais supprimé : user.delete n'est pas appelé", async () => {
    const res = await callDelete();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ anonymized: true, physicalDelete: false });
    expect(db.userDelete).not.toHaveBeenCalled();
    // La ligne `User` survit : c'est la clé étrangère de l'historique probant
    // (ExamSession / AuditLog / CorrectionRequest / Reclamation en RESTRICT).
    expect(db.userUpdate).toHaveBeenCalledTimes(1);
  });

  it("l'anonymisation préserve l'attestation et sa vérifiabilité", async () => {
    const res = await callDelete();
    expect(res.status).toBe(200);
    // Le compte reste rattaché : l'attestation n'est jamais réécrite, donc
    // `userId` survit, le lien est intact et la preuve reste vérifiable.
    expect(db.attestationCount).toHaveBeenCalledWith({ where: { userId: "user-1" } });
    expect(db.userFindUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
      select: expect.any(Object),
    });
  });

  it("garde statique : la route n'écrit ni n'efface aucune attestation ni session", () => {
    const source = stripComments(
      readFileSync(join(process.cwd(), "app/api/users/[id]/route.ts"), "utf8"),
    );
    // Ni suppression physique du compte, ni réécriture d'une preuve officielle.
    expect(source).not.toMatch(/user\.delete\(/);
    expect(source).not.toMatch(/attestation\.update\w*\(/);
    expect(source).not.toMatch(/attestation\.delete\w*\(/);
    expect(source).not.toMatch(/examSession\.update\w*\(/);
    expect(source).not.toMatch(/examSession\.delete\w*\(/);
  });

  it("les sessions d'examen et leurs réponses sont conservées", async () => {
    const res = await callDelete();
    expect(res.status).toBe(200);
    expect(db.examSessionCount).toHaveBeenCalledWith({ where: { userId: "user-1" } });
    const payload = await res.json();
    expect(payload.preserved).toMatchObject({ examSessions: 2, attestations: 3 });
  });

  it("les sessions vivantes sont révoquées via revokeUserSessions (source unique)", async () => {
    const res = await callDelete();
    expect(res.status).toBe(200);
    expect(deps.revokeUserSessions).toHaveBeenCalledTimes(1);
    expect(deps.revokeUserSessions.mock.calls[0][0]).toBe("user-1");
    expect((await res.json()).revokedSessions).toBe(2);
  });

  it("les credentials sont purgés : plus rien pour se reconnecter", async () => {
    await callDelete();
    expect(db.accountDeleteMany).toHaveBeenCalledWith({ where: { userId: "user-1" } });
    expect(db.twoFactorDeleteMany).toHaveBeenCalledWith({ where: { userId: "user-1" } });
    expect(db.verificationDeleteMany).toHaveBeenCalledWith({
      where: { identifier: "awa.diallo@exemple.test" },
    });

    const { data } = db.userUpdate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(data.password).toBeNull();
    expect(data.email).toBeNull();
    expect(data.emailVerified).toBeNull();
    // Le drapeau 2FA est rabattu : aucun secret ne reste derrière lui.
    expect(data.twoFactorEnabled).toBe(false);
  });

  it("le compte devient inutilisable : statut bloquant + bannissement Better Auth", async () => {
    await callDelete();
    const { data } = db.userUpdate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(data.status).toBe("BLOCKED");
    expect(data.banned).toBe(true);
    expect(data.banExpires).toBeNull();
    expect(data.role).toBe("user");
    expect(String(data.banReason)).toContain("anonymisé");
  });

  it("un administrateur ne peut pas effacer son propre compte", async () => {
    const res = await DELETE(makeRequest(undefined), { params: Promise.resolve({ id: "admin-1" }) });
    expect(res.status).toBe(409);
    expect(db.userUpdate).not.toHaveBeenCalled();
    expect(deps.createAuditLog).not.toHaveBeenCalled();
  });

  it("le dernier administrateur actif ne peut pas être effacé", async () => {
    db.userFindUnique.mockResolvedValue(makeTarget({ role: "admin" }) as never);
    db.userCount.mockResolvedValue(0 as never);
    const res = await callDelete();
    expect(res.status).toBe(409);
    expect(db.userUpdate).not.toHaveBeenCalled();
  });

  it("un motif lisible est repris quand l'appelant en fournit un", async () => {
    await callDelete({ reason: "Demande recevable du titulaire (RGPD art. 17)" });
    const [entry] = deps.createAuditLog.mock.calls[0] as [Record<string, unknown>];
    expect((entry.newValue as Record<string, unknown>).reason).toBe(
      "Demande recevable du titulaire (RGPD art. 17)",
    );
  });

  it("un motif par défaut est journalisé quand l'appelant n'en fournit pas", async () => {
    const res = await callDelete();
    expect(res.status).toBe(200);
    const [entry] = deps.createAuditLog.mock.calls[0] as [Record<string, unknown>];
    expect((entry.newValue as Record<string, unknown>).reason).toBeTruthy();
  });

  it("409 si une clé étrangère en RESTRICT bloque l'effacement, compte intact", async () => {
    db.userUpdate.mockRejectedValue(Object.assign(new Error("db down"), { code: "P2003" }));
    const res = await callDelete();
    expect(res.status).toBe(409);
    expect(db.userDelete).not.toHaveBeenCalled();
  });

  it("500 si l'écriture échoue pour une autre cause", async () => {
    db.userUpdate.mockRejectedValue(new Error("db down") as never);
    const res = await callDelete();
    expect(res.status).toBe(500);
    expect(db.userDelete).not.toHaveBeenCalled();
  });
});
