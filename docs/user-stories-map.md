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

# Cartographie des threats et exigences système

## Evil stories — abus et menaces

Une evil story représente une menace distincte et l’exigence de maîtrise correspondante. Les contrôles techniques ne sont pas comptés comme des stories supplémentaires.

| Catégorie | Implémentées | Partielles | À créer | Total |
|---|---:|---:|---:|---:|
| Injection et exécution de code | 3 | 1 | 2 | 6 |
| Contrôle d’accès et élévation | 4 | 0 | 2 | 6 |
| Authentification, session, 2FA | 4 | 3 | 2 | 9 |
| Données et secrets | 3 | 3 | 1 | 6 |
| Fichiers et uploads | 3 | 0 | 1 | 4 |
| Intégrité documents et examens | 6 | 3 | 0 | 9 |
| Surface web etheaders | 3 | 2 | 0 | 5 |
| **Total** | **26** | **12** | **8** | **46** |

### Écarts prioritaires

- **EVIL-DAT-01** : l’API publique de vérification sélectionne et retourne des PII internes (`email`, `birthDate`, `birthPlace`, `gender`, `userId`, `sessionId`).
- **EVIL-AUT-03** : existence d’un secret de session fallback en développement et risque de l’utiliser en production.
- **EVIL-AUT-04** : `trustedOrigins` contient des jokers trop larges (`*.vercel.app`, tunnels et réseau local).
- **EVIL-INJ-06** : `next/image` autorise des hôtes `**` et `http`, ouvrant un risque SSRF.
- **EVIL-AUT-05** : le CSRF repose principalement sur `SameSite`, alors que la page publique promet un jeton CSRF.
- **EVIL-ACC-06** : absence de RBAC et de super admin ; tous les admins ont les mêmes pouvoirs.
- **EVIL-FIL-03** : `/api/upload` n’a pas de rate limit.
- **EVIL-AUT-02** : certains flux auth limitent uniquement par IP, et l’en-tête `x-forwarded-for` doit être fiable.
- **EVIL-DOC-02** : l’émission peut continuer sans `CERT_SEAL_SECRET` au lieu d’être bloquée.
- **EVIL-INJ-02** : `sanitizeHTML` existe mais n’est pas branché sur les champs concernés.

## System stories — exigences techniques

Une system story représente une propriété technique distincte du système.

| Domaine | Implémentées | Partielles | À créer | Total |
|---|---:|---:|---:|---:|
| CI/CD et livraison | 9 | 1 | 0 | 10 |
| Base de données, migrations et concurrence | 8 | 0 | 0 | 8 |
| Disponibilité et résilience | 5 | 1 | 1 | 7 |
| Sauvegarde, R2 et stockage | 8 | 0 | 0 | 8 |
| Observabilité, audit et traçabilité | 7 | 2 | 2 | 11 |
| Qualité, tests et E2E | 6 | 1 | 0 | 7 |
| Sécurité et secrets | 4 | 0 | 1 | 5 |
| Performance et capacité | 2 | 0 | 0 | 2 |
| Accessibilité technique et documentation | 2 | 1 | 0 | 3 |
| **Total** | **51** | **6** | **4** | **61** |

### Écarts prioritaires

- **SYS-REL-02** : créer `/api/ready` avec vérification DB/cache, distincte de `/api/health`.
- **SYS-OBS-04** : créer la page admin `/admin/logs` et la rétention des audit logs.
- **SYS-CICD-10** : rollback applicatif par tag/image SHA.
- **SYS-CICD-11** : alertes planifiées sur fraîcheur R2, versioning et readiness.

## Total consolidé

| Ensemble | Implémentées | Partielles | À créer | Total |
|---|---:|---:|---:|---:|
| User stories | 118 | 11 | 6 | 135 |
| Evil stories | 26 | 12 | 8 | 46 |
| System stories | 51 | 6 | 4 | 61 |
| **Total** | **195** | **29** | **18** | **242** |

**Couverture globale claire : 80,6 % implémentée, 12 % partielle, 7,4 % à créer.**

## Angles morts non encore pensés

Audit indépendant postérieur aux cartographies user/evil/system. Ces risques ne sont pas des corrections ponctuelles : ils nécessitent une décision produit, juridique ou d’exploitation.

### P0 — capitaux

- **Document officiel supprimable** : la route DELETE peut supprimer une attestation déjà imprimée ; prévoir soft-delete, motif et registre de révocation.
- **Sceau partiel** : les attestations FORMATION/STAGE ne sont pas protégées par le sceau v2 ; `proof.valid` ne doit pasclaimed une preuve incomplète.
- **Révocation destructrice** : REVOKE/RETROGRADE doivent être auditées et ne jamais supprimer les sessions ou réponses.
- **Identité fictive** : interdire les valeurs de remplacement (`Candidat Anonyme`, date du jour, lieu inconnu) dans un document officiel.
- **Claim-code** : limiter fortement la force brute et empêcher l’écrasement silencieux du profil du titulaire.
- **Blocage de compte inopérant** : appliquer `BLOCKED/SUSPENDED` et révoquer les sessions actives.
- **Opérateur/domaine unique** : prévoir domaine institutionnel, escalade et continuité des QR.
- **RPO/RTO** : sauvegarde hors site chiffrée et restauration réellement pratiquée.
- **Générateur PDF hors dépôt** : versionner, tester et valider juridiquement le gabarit officiel.

### P1 — structurels

- **Rotation de clé** : versionner et faire tourner `CERT_SEAL_SECRET` sans invalider l’historique.
- **REJECTED vs REVOKED** : distinguer les états publiquement.
- **Rate limiting fail-open** : comportement distribué et fail-closed sur les routes sensibles.
- **Rôles** : source de vérité unique, normalisation et audit des élévations.
- **Emails** : outbox, retry, bounce/webhook et domaine d’envoi contrôlé.
- **Mentions légales** : Pages légales, cookies, transferts hors UE et hébergeur réellement publiés.
- **Funnel** : instrumentation first-party sans PII pour mesurer inscription → attestation.
- **Statistiques publiques** : agréger ou restreindre les compteurs d’exploitation.
- **Numérotation FSA** : remplacer `count + 1` par une séquence transactionnelle.
- **Fuseaux horaires** : définir une référence unique et normaliser dates-only/timestamps.

### P2 — robustesse

- Sessions d’examen abandonnées : expiration automatique et reprise contrôlée.
- Catalogue de formations : empêcher les créations automatiques depuis une saisie d’attestation.
- Purge automatique et quotas de stockage par compte.
- Logs structurés, corrélation et masquage des PII dans les audits.
- Invariants de validation des attestations et champs Zod non persistés.
