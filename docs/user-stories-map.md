# Cartographie des user stories — Plateforme FSA

Date : 2026-09-25
Périmètre : application publique, espace candidat, back-office, API, modèle Prisma, tests et documentation.

## Méthode

Une user story représente un besoin métier distinct. Les écrans, onglets, boutons, champs et variantes d’un même besoin ne sont pas comptés comme des stories supplémentaires.

Exclusion : worktrees Git, artefacts `.next/`, `Backup/`, `reports/`, `node_modules/` et documents archivés.

Statuts :

- **Implémentée** : page, API, modèle et contrôle cohérents.
- **Partielle** : besoin couvert mais écart fonctionnel ou critère incomplet.
- **Non livrée** : besoin documenté mais absent du code.
- **À confirmer** : décision produit ou design non tranché.

## Acteurs

| Acteur | Rôle |
|---|---|
| Public / visiteur | Découvrir l’offre, s’inscrire, vérifier, candidater |
| Candidat | Utiliser les formations, examens, résultats, attestations et demandes de stage |
| Administrateur | Gérer utilisateurs, catalogue, examens, notes, attestations, stages et support |
| Opérateur | Déployer, sauvegarder, restaurer, surveiller et auditer |
| Super admin | Rôle non implémenté actuellement |

## Synthèse

| Acteur | Stories |
|---|---:|
| Public / visiteur | 18 |
| Candidat | 47 |
| Administrateur | 52 |
| Opérateur | 18 |
| **Total** | **135** |

## Avancement

| Statut | Nombre | Pourcentage |
|---|---:|---:|
| Implémentée | 118 | 87 % |
| Partielle | 11 | 8 % |
| Non livrée | 5 | 4 % |
| À confirmer | 1 | 1 % |
| **Total** | **135** | **100 %** |

## Catalogue par domaine

| Domaine | Stories | État dominant |
|---|---:|---|
| Public et conversion | 18 | Implémenté, sauf QR partiel |
| Compte et authentification | 7 | Implémenté, 2FA à renforcer côté serveur |
| Formations | 5 | Implémenté, détails admin incomplets |
| Inscriptions et éligibilité | 5 | Implémenté après M9 |
| Stages et entreprises | 7 | Partiel, workflow à sécuriser |
| Examens et évaluations | 20 | Partiel, anti-triche et monitoring incomplets |
| Résultats et transcripts | 6 | Transcripts non livrés |
| Attestations et certificats | 17 | Partiel, Ed25519 non implémenté |
| Notifications | 7 | Temps réel et delivery status absents |
| Profil et support | 11 | Support candidat absent |
| Administration | 17 | Plusieurs pages de détail/audit absentes |
| Infrastructure et opérations | 18 | Globalement implémenté, supervision à compléter |

## Écarts prioritaires

### P0 — sécurité et production

1. URL de CV arbitraire et flux utilisateur non sécurisé.
2. Attestation de stage générée pour une demande non acceptée ou en double.
3. Validation des notes, dates et observations d’attestation.
4. Machine à états, audit et validation des statuts admin.
5. Export PII, rétention et suppression des CV.

### P1 — conformité et traçabilité

1. Notifications/email pour les candidats anonymes.
2. Quotas de candidatures séparés et难以 à contourner.
3. Divergences UI/API du module stages.
4. Anti-triche réellement implémentée.
5. Monitoring des examens.

### P2 — produits annoncés mais non livrés

1. Transcripts et relevés officiels.
2. Notifications temps réel.
3. Support candidat.
4. Journal d’audit consultable.
5. Pages de détail et actions groupées.

## Décision sur le super admin

Le modèle actuel ne distingue pas les rôles finer-grain : tous les administrateurs ont les mêmes capacités. Avant de créer un rôle `SUPER_ADMIN`, il faut décider :

- la granularité des permissions ;
- les actions réservées (utilisateurs, paramètres, révocations, exports) ;
- la compatibilité avec les audits existants ;
- la migration des administrateurs actuels.

## Règles de mise à jour

Toute nouvelle story doit avoir :

- un acteur ;
- un besoin métier ;
- un critère d’acceptation testable ;
- une ou plusieurs routes principales ;
- un statut ;
- une issue de suivi si elle n’est pas implémentée.

Les stories non livrées ne doivent pas être présentées comme complètes dans la documentation produit.
