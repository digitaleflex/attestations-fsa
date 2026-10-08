/**
 * Fabriques de fixtures déterministes pour les tests (issue #11).
 *
 * Formes alignées sur `prisma/schema.prisma`, valeurs factices. Chaque
 * fabrique accepte des surcharges partielles typées.
 */

function withOverrides<T extends object>(base: T, overrides: Partial<T>): T {
  return { ...base, ...overrides };
}

/** Ligne `User` minimale (rôle `user` par défaut). */
export function makeUserFixture(
  overrides: Partial<ReturnType<typeof makeUserFixtureBase>> = {},
) {
  return withOverrides(makeUserFixtureBase(), overrides);
}

function makeUserFixtureBase() {
  return {
    id: "user-test-1",
    name: "Utilisateur Test",
    email: "user@example.com",
    emailVerified: null as Date | null,
    image: null as string | null,
    role: "user",
    twoFactorEnabled: false,
    status: "ACTIVE",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

/** Ligne `User` administratrice. */
export function makeAdminFixture(
  overrides: Partial<ReturnType<typeof makeUserFixture>> = {},
) {
  return makeUserFixture({
    id: "admin-test-1",
    name: "Admin Test",
    email: "admin@example.com",
    role: "ADMIN",
    ...overrides,
  });
}

/** Ligne `Attestation` minimale (statut `PENDING`). */
export function makeAttestationFixture(
  overrides: Partial<ReturnType<typeof makeAttestationFixtureBase>> = {},
) {
  return withOverrides(makeAttestationFixtureBase(), overrides);
}

function makeAttestationFixtureBase() {
  return {
    id: "att-test-1",
    code: "FSA-2026-M01-00042-f0f9a",
    type: "FORMATION",
    fullName: "Alice Dupont",
    email: "alice@example.com",
    birthDate: new Date("1990-01-01T00:00:00.000Z"),
    birthPlace: "Cotonou",
    formationId: "formation-test-1",
    startDate: new Date("2026-01-05T00:00:00.000Z"),
    endDate: new Date("2026-01-10T00:00:00.000Z"),
    location: "Abomey-Calavi",
    instructor: "Formateur Test",
    issuingCompany: "Ferme St André",
    status: "PENDING",
    userId: null as string | null,
  };
}

/** Ligne `Settings` (valeurs par défaut du schéma). */
export function makeSettingsFixture(
  overrides: Partial<ReturnType<typeof makeSettingsFixtureBase>> = {},
) {
  return withOverrides(makeSettingsFixtureBase(), overrides);
}

function makeSettingsFixtureBase() {
  return {
    id: "settings-test-1",
    institutionName: "Ferme Agro-Piscicole Cité St André",
    replyTo: null as string | null,
    targetAttestations: 300,
    targetInscriptions: 500,
    targetValidations: 450,
    instructorName: "Directeur Technique",
    instructorTitle: "Responsable des Formations",
    location: "Abomey-Calavi",
    supportEmail: "contact@fermestandre.com",
  };
}

/**
 * Ligne `TwoFactor` better-auth (secret TOTP et codes de secours FACTICES,
 * jamais utilisables en production).
 */
export function makeTwoFactorFixture(
  overrides: Partial<ReturnType<typeof makeTwoFactorFixtureBase>> = {},
) {
  return withOverrides(makeTwoFactorFixtureBase(), overrides);
}

function makeTwoFactorFixtureBase() {
  return {
    id: "twofactor-test-1",
    secret: "JBSWY3DPEHPK3PXP",
    backupCodes: JSON.stringify(["BACKUP-01-AA", "BACKUP-02-BB"]),
    userId: "admin-test-1",
    verified: true as boolean | null,
  };
}
