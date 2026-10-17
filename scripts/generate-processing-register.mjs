#!/usr/bin/env node
/**
 * Registre des traitements (RGPD art. 30 / APDP Bénin) — #153
 *
 * Génère `docs/legal/registre-des-traitements.md` À PARTIR DU SCHÉMA RÉEL
 * (`prisma/schema.prisma`) et des pièces réelles du dépôt.
 *
 * ## Pourquoi un générateur
 *
 * Un registre écrit à la main se désynchronise du produit dès la première
 * migration : c'est exactement le défaut que #297 essaie de corriger sur la
 * documentation. Ici la source de vérité est le schéma, donc le registre
 * ne peut pas mentir sur ce qui existe.
 *
 * Chaque table est classée par nature (donnée personnelle / probante /
 * technique) et le registre cite le champ `retentionUntil` ou la durée
 * lorsqu'elle existe — la politique de rétention reste la source unique
 * (`docs/legal/retention-policy.md`), le registre ne fait que la référencer.
 *
 * ## Ce que ce registre NE fait pas
 *
 * Il ne remplace pas la politique de rétention, ni l'analyse d'impact, ni
 * l'information des personnes. Il documente ce que la plateforme traite
 * RÉELLEMENT aujourd'hui.
 *
 * Usage : `node scripts/generate-processing-register.mjs`
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

const SCHEMA = join(process.cwd(), "prisma", "schema.prisma");
const OUTPUT = join(process.cwd(), "docs", "legal", "registre-des-traitements.md");

/**
 * Classification par finalité. Volontairement explicite plutôt que déduit :
 * une table absente de cette liste est signalée, jamais classée en silence.
 */
const REGISTRY = {
  User: {
    nature: "Donnée personnelle",
    finality: "Gestion de compte candidat, authentification, suivi pédagogique",
    basis: "Exécution du contrat (préinscription, inscription, passage d'examen)",
    retention: "Jusqu'à la demande d'effacement, puis anonymisation (#291)",
    sensitive: "Oui — identité (nom, prénom, date et lieu de naissance, sexe), contact",
  },
  Account: {
    nature: "Donnée personnelle",
    finality: "Authentification (mot de passe haché, jetons OAuth)",
    basis: "Exécution du contrat",
    retention: "Jusqu'à l'effacement du compte — purgé à l'anonymisation",
    sensitive: "Oui — secrets d'authentification",
  },
  Session: {
    nature: "Donnée personnelle",
    finality: "Maintien de la session authentifiée",
    basis: "Exécution du contrat",
    retention: "Expirée automatiquement ; révoquée à l'effacement",
    sensitive: "Non — jeton technique",
  },
  Verification: {
    nature: "Donnée personnelle",
    finality: "Vérification d'adresse e-mail, réinitialisation de mot de passe, OTP 2FA",
    basis: "Exécution du contrat",
    retention: "Courte — purgé à l'anonymisation du compte",
    sensitive: "Non — identifiant technique",
  },
  TwoFactor: {
    nature: "Donnée personnelle",
    finality: "Second facteur d'authentification administrateur (décision #74)",
    basis: "Exécution du contrat",
    retention: "Tant que le 2FA est actif ; purgé à l'effacement",
    sensitive: "Oui — secret TOTP, codes de secours (chiffrés en production)",
  },
  Formation: {
    nature: "Donnée non personnelle",
    finality: "Catalogue de formations",
    basis: "Intérêt légitime",
    retention: "Durée de vie de la formation",
    sensitive: "Non",
  },
  Exam: {
    nature: "Donnée non personnelle",
    finality: "Définition et planification des examens",
    basis: "Exécution du contrat",
    retention: "Durée de vie de l'examen",
    sensitive: "Non",
  },
  ExamPart: { nature: "Donnée non personnelle", finality: "Structure d'un examen", basis: "Exécution du contrat", retention: "Durée de vie de l'examen", sensitive: "Non" },
  Question: { nature: "Donnée non personnelle", finality: "Banque de questions", basis: "Exécution du contrat", retention: "Durée de vie de l'examen", sensitive: "Non" },
  QuestionOption: { nature: "Donnée non personnelle", finality: "Réponses possibles", basis: "Exécution du contrat", retention: "Durée de vie de l'examen", sensitive: "Non" },
  ExamSession: {
    nature: "Donnée personnelle",
    finality: "Passage d'examen, calcul de score, attestation — PIÈCE PROBANTE",
    basis: "Obligation légale et contractuelle",
    retention: "Illimitée — session probante conservée",
    sensitive: "Oui — résultats, chronologie, journaux anti-triche",
  },
  ExamEnrollment: {
    nature: "Donnée personnelle",
    finality: "Liaison candidat ↔ examen ↔ promotion",
    basis: "Exécution du contrat",
    retention: "Durée du suivi pédagogique",
    sensitive: "Non",
  },
  Attestation: {
    nature: "Donnée personnelle",
    finality: "Délivrance, vérification et révocation d'attestations — PIÈCE PROBANTE",
    basis: "Obligation légale",
    retention: "Illimitée — attestation émise non destructible",
    sensitive: "Oui — identité du titulaire, code, sceau, hash de valeur probante",
  },
  InternshipRequest: {
    nature: "Donnée personnelle",
    finality: "Demande, suivi et évaluation de stage",
    basis: "Exécution du contrat",
    retention: "Durée du stage + durée légale",
    sensitive: "Oui — CV et coordonnées",
  },
  CorrectionRequest: {
    nature: "Donnée personnelle",
    finality: "Contestation d'un résultat par le candidat",
    basis: "Obligation légale",
    retention: "Durée du dispositif de recours",
    sensitive: "Oui — motif et pièces jointes",
  },
  Reclamation: {
    nature: "Donnée personnelle",
    finality: "Réclamation et litige",
    basis: "Obligation légale",
    retention: "Durée du dispositif de recours",
    sensitive: "Oui — contenu de la réclamation",
  },
  Contact: {
    nature: "Donnée personnelle",
    finality: "Prise de contact depuis le site public",
    basis: "Intérêt légitime / demande de la personne",
    retention: "Durée du traitement de la demande",
    sensitive: "Oui — coordonnées libres",
  },
  Report: {
    nature: "Donnée personnelle",
    finality: "Signalement d'un contenu (fusionné avec Contact, #110)",
    basis: "Intérêt légitime",
    retention: "Durée du traitement du signalement",
    sensitive: "Oui — contenu du signalement",
  },
  Notification: {
    nature: "Donnée personnelle",
    finality: "Notifications in-app (résultats, validations)",
    basis: "Exécution du contrat",
    retention: "Jusqu'à suppression par l'utilisateur",
    sensitive: "Non",
  },
  AuditLog: {
    nature: "Donnée personnelle",
    finality: "Traçabilité des actions d'administration — obligation de preuve",
    basis: "Obligation légale",
    retention: "365 jours (`AUDIT_LOG_RETENTION_DAYS`), purgée par le cron",
    sensitive: "Oui — traces nominatives, IP",
  },
  StoredObject: {
    nature: "Donnée personnelle",
    finality: "Stockage des fichiers déposés : CV, scans de copies, PDF officiels",
    basis: "Exécution du contrat / obligation légale",
    retention: "365 j (non probants) ; illimitée (PDF officiels) — `retentionUntil`",
    sensitive: "Oui — contenu de fichier nominatif",
  },
  Consent: {
    nature: "Donnée personnelle",
    finality: "Preuve des acceptations (CGU, confidentialité, transferts hors UE) et des retraits — RGPD art. 7",
    basis: "Consentement / exécution du contrat",
    retention: "Tant que le compte existe — append-only, jamais supprimé (une révocation ne détruit pas la preuve du retrait)",
    sensitive: "Oui — horodatage, IP, user-agent, version du document",
  },
  Settings: {
    nature: "Donnée non personnelle",
    finality: "Paramètres de la plateforme",
    basis: "Intérêt légitime",
    retention: "Durée de vie",
    sensitive: "Non",
  },
};

const SUBPROCESSORS = [
  { name: "Resend", role: "Envoi d'e-mails (verification, notifications, OTP)", data: "Adresse e-mail, nom", place: "États-Unis", legal: "EU-US Data Privacy Framework" },
  { name: "Cloudflare R2", role: "Stockage objet des fichiers", data: "Contenu de fichier, clé de stockage", place: "États-Unis", legal: "À vérifier avant mise en production (sous-traitance hors UE)" },
  { name: "Upstash Redis", role: "Rate limiting, cache de session technique", data: "Clés de rate limit, jetons", place: "États-Unis", legal: "À vérifier avant mise en production" },
];

function main() {
  const schema = readFileSync(SCHEMA, "utf8");
  const tables = [...schema.matchAll(/^model\s+(\w+)\s*\{/gm)].map((m) => m[1]);

  const unknown = tables.filter((t) => !REGISTRY[t]);
  const unknownHtml = unknown.length
    ? [
        "",
        "## ⚠️ Tables non classifiées",
        "",
        "Ces tables existent dans le schéma mais **n'ont pas été classifiées**",
        "dans le générateur. À traiter avant la mise en production :",
        "",
        ...unknown.map((t) => `- \`${t}\``),
        "",
      ].join("\n")
    : "";

  const rows = tables
    .map((t) => {
      const r = REGISTRY[t];
      const base = `| \`${t}\` | ${r.nature} | ${r.finality} | ${r.basis} | ${r.retention} |`;
      return r ? base : `| \`${t}\` | **NON CLASSIFIÉE** | — | — | — |`;
    })
    .join("\n");

  const subprocessorRows = SUBPROCESSORS.map(
    (s) => `| ${s.name} | ${s.role} | ${s.data} | ${s.place} | ${s.legal} |`,
  ).join("\n");

  const generatedAt = new Date().toISOString().slice(0, 10);

  const md = `# Registre des traitements

> **Généré automatiquement** par \`scripts/generate-processing-register.mjs\` — ne pas
> éditer à la main. Source de vérité : \`prisma/schema.prisma\`.
>
> Obligation RGPD art. 30 / APDP Bénin. Généré le **${generatedAt}** :
> ${tables.length} tables classifiées.

## Comment lire ce registre

Ce registre décrit ce que la plateforme traite **réellement aujourd'hui**. Il est
dérivé du schéma Prisma plutôt qu'écrit à la main, donc il ne peut pas dériver du
produit après une migration.

La **durée de conservation** n'est pas décidée ici : elle fait l'objet de
\`docs/legal/retention-policy.md\`, qui reste la source unique et définit le champ
technique (\`StoredObject.retentionUntil\`, \`AUDIT_LOG_RETENTION_DAYS\`) et les jobs
de purge.

## Données collectées — vue d'ensemble

| Catégorie | Contenu |
| :--- | :--- |
| **Identité** | Nom, prénom, date et lieu de naissance, sexe |
| **Contact** | Adresse e-mail, téléphone, adresse postale |
| **Pédagogique** | Examens passés, scores, mentions, attestations, QR de vérification |
| **Documents** | CV, scans de copies d'examen, PDF d'attestation officiels |
| **Sécurité** | Journal d'audit, IP, journaux anti-triche, secrets 2FA |

## Traitements par finalité

| Table | Nature | Finalité | Base légale | Conservation |
| :--- | :--- | :--- | :--- | :--- |
${rows}

## Sous-traitants

| Sous-traitant | Rôle | Données | Localisation | Cadre |
| :--- | :--- | :--- | :--- | :--- |
${subprocessorRows}

> Les deux mentions « à vérifier » doivent être levées avant la mise en production
> (#153) : sans Garantie de sous-traitance correcte, un transfert hors UE n'est pas
> encadré. À traiter avec l'APDP.

## Transferts hors UE

La plateforme est hébergée hors de l'Union européenne. Tout transfert repose sur
les garanties listées ci-dessus. **Point ouvert** : les garanties de Cloudflare R2
et d'Upstash doivent être confirmées et versées au dossier avant ouverture du
service aux candidats (cf. #153).

## Sécurité au repos — point ouvert

- **OTP et codes de secours 2FA** : chiffrés en production (\`storeOTP\` /
  \`storeBackupCodes\` = \`encrypted\`, \`lib/auth.ts\`).
- **Mots de passe** : hachés par Better Auth, jamais stockés en clair.
- **Fichiers déposés (CV, scans)** : **non chiffrés au repos**. Seul un SHA-256
  d'\`intégrité\` est calculé (\`lib/storage/registry.ts\`, \`computeChecksum\`).
  Le chiffrement de l'\`at rest\` est identifié comme un besoin mais **n'est pas
  implémenté** : il exigerait de migrer les objets déjà stockés, donc il est
  traité séparément et non dans le cadre de #153.

## Droits des personnes

| Droit | Mise en œuvre |
| :--- | :--- |
| **Accès / portabilité** | \`GET /api/user/export\` — export des données personnelles |
| **Effacement** | \`DELETE /api/users/[id]\` — anonymisation transactionnelle, preservatives des obligations probantes (#291, action \`ACCOUNT_ANONYMIZED\`) |
| **Conservation** | \`docs/legal/retention-policy.md\` + cron \`retention-purge\` |
| **Rectification** | \`PATCH /api/users/[id]\` et \`/api/user/profile\` |
| **Retrait du consentement** | \`POST /api/user/consent\` — révocation de \`MARKETING\` ; pour les autres, l'effacement du compte |
| **Opposition** | Contact via \`/contact\` — **traitement manuel, aucune procedure automatisee** |
${unknownHtml}
---

## Ce qui reste à faire (cf. #153)

1. **Chiffrement des fichiers déposés au repos** — non implémenté, exigerait une
   migration des objets existants ; traité hors périmètre de #153.
2. **Levée de la réserve sur les transferts hors UE** (Cloudflare R2, Upstash).
3. **Cases à cocher dans l'interface** — la table \`Consent\` et l'API
   \`/api/user/consent\` existent, mais les cases du parcours d'inscription ne
   sont pas encore câblées côté client : les consentements ne sont donc pas
   enregistrés en pratique tant que ce n'est pas fait.
`;

  writeFileSync(OUTPUT, md, "utf8");
  console.log(`OK : registre écrit dans ${OUTPUT}`);
  console.log(`    ${tables.length} tables classifiées, ${unknown.length} non classifiée(s).`);
  if (unknown.length) {
    console.error("    Les tables non classifiées doivent être traitées (voir le fichier).");
    process.exit(1);
  }
}

main();