# Spécification M9 — Finalisation des issues #255 à #260

Date : 2026-09-25
Branche de travail : `chore/node-24-lts`
PR de référence : #263

## 1. Objectif

Finaliser les issues M9 #255 à #260 sans modifier les codes `FSA-*` existants, sans supprimer d’attestation historique et sans fabriquer de preuve de scellement absente.

La vague traite uniquement les issues #255 à #260. Les issues #261 et #262 restent hors périmètre de cette vague.

## 2. Invariants non négociables

- `Attestation.code` est immuable.
- Une attestation existante n’est jamais supprimée, renumérotée ou dupliquée.
- Aucun HMAC rétroactif n’est créé sans preuve métier.
- Les URLs signées ne sont jamais écrites dans la base.
- Les opérations de migration sont read-only par défaut.
- Les migrations sont additives, idempotentes et compatibles avec les clés `TEXT` historiques.
- Les opérations R2 ne sont jamais exécutées contre un bucket réel pendant les tests automatisés.

## 3. Lots et dépendances

### Lot A — #255 et #259 : gel et migration historique

Périmètre : inventaire de référence, sauvegarde/restauration, classification des attestations, rapport de migration read-only.

Travail :

1. Produire un export versionné et relisible des attestations, sessions, utilisateurs, formations et relations.
2. Enregistrer un manifeste de sauvegarde avec hash, volume couvert et date.
3. Fournir une procédure de restauration testée sur une base isolée.
4. Ajouter une protection applicative et une contrainte de défense contre la modification des codes.
5. Classer les attestations selon les catégories `LEGACY_UNSEALED`, `SEALABLE_WITH_EVIDENCE`, `REISSUE`, `REVOKED`, `REQUIRES_REVIEW` et `MIGRATION_BLOCKED`.
6. Documenter la période inversée comme bloquante jusqu’à validation métier.
7. Vérifier le QR et la preuve publique d’un échantillon contrôlé.

Sortie : 40 codes inchangés, export reproductible, restauration testée, rapport de classification versionné et aucune écriture automatique non approuvée.

### Lot B — #256 et #257 : éligibilité et sessions

Périmètre : contrôle d’accès aux examens OFFICIAL/MOCK, transitions de session, barème reproductible.

Travail :

1. Vérifier l’éligibilité sur GET, start, draft et submit.
2. Refuser un OFFICIAL sans enrollment ; conserver le comportement MOCK documenté.
3. Ajouter les champs de suivi nécessaires à `ExamEnrollment` sans migration destructive.
4. Centraliser la fonction de score et le snapshot versionné du barème.
5. Refuser toute correction sans soumission et toute transition concurrente invalide.
6. Valider les identifiants de questions, la taille des réponses et les doublons de soumission.
7. Ajouter rate-limit aux points d’entrée sensibles non couverts.

Sortie : un candidat non inscrit ne peut pas lire, démarrer ou soumettre un OFFICIAL ; le score est reproductible et les transitions concurrentes sont sûres.

### Lot C — #258 : preuve officielle

Périmètre : session liée, sceau versionné, PDF serveur, stockage R2 et QR.

Travail :

1. Rendre `sessionId` obligatoire pour les nouvelles `CERTIFICATION`.
2. Conserver la contrainte historique `NOT VALID` tant que les 40 attestations ne sont pas rapprochées.
3. Générer exclusivement le PDF côté serveur et le stocker sous une clé versionnée.
4. Calculer et persister `pdfHash`, `pdfVersion`, `pdfGeneratedAt` et `sealVersion`.
5. Resceller les corrections autorisées sans modifier le code historique.
6. Vérifier le QR vers `/verifier?code=...` et le téléchargement contrôlé.
7. Supprimer les derniers téléchargements PDF générés dans le navigateur.

Sortie : certification liée, preuve scellée, PDF serveur stocké/hashé et vérifiable publiquement.

### Lot D — #260 : sécurité et opérations R2

Périmètre : propriété, versioning, sauvegarde et restauration des objets R2.

Travail :

1. Conserver `StoredObject` comme registre de propriété et de rétention.
2. Vérifier les préfixes `cv/`, `stages/`, `attestations/`, `exports/`, `temporary/`.
3. Maintenir des URLs signées courtes et un téléchargement public contrôlé.
4. Ajouter les contrôles de versioning, fraîcheur de sauvegarde et alerting.
5. Documenter la sauvegarde/restauration R2 avec AWS CLI et variables externalisées.
6. Tester les scripts en dry-run et avec fixtures locales uniquement.
7. Ne jamais afficher ni committer de credentials R2.

Sortie : aucun objet croisé accessible/supprimable, versioning vérifiable et procédure de restauration reproductible.

## 4. Organisation du travail

Chaque lot est implémenté dans un worktree et une branche dédiés :

- `m9/final-255-259`
- `m9/final-256-257`
- `m9/final-258`
- `m9/final-260`

Les périmètres de fichiers sont disjoints autant que possible. Les routes partagées ne sont modifiées qu’après vérification du conflit.

## 5. Validation commune

Avant intégration :

- `pnpm exec tsc --noEmit`
- ESLint ciblé sur les fichiers modifiés
- tests unitaires et API ciblés
- tests de non-régression d’intégrité
- `git diff --check`
- vérification qu’aucun secret, dump ou rapport sensible n’est committé

Après intégration :

- suite complète
- E2E candidat et vérification publique
- build Next.js
- contrôle de la PR #263

## 6. Critères de clôture GitHub

Une issue ne peut être fermée que si :

- ses critères de sortie sont satisfaits ;
- les tests associés passent ;
- les preuves sont documentées dans la PR ou un artefact versionné sûr ;
- aucun blocant production n’est connu.

Sinon, l’issue reste ouverte avec un commentaire précis indiquant le critère restant.

## 7. Limites attendues

- Snyk peut continuer à échouer pour quota externe ; ce point ne doit pas être traité comme une preuve de vulnérabilité du code.
- Une restauration R2 réelle nécessite les credentials et l’environnement de production ; les tests automatisés restent locaux et simulés.
- La validation métier de la période inversée est obligatoire avant toute action sur les attestations concernées.
