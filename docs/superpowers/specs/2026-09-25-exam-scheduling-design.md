# Spécification — Ouverture sécurisée des examens planifiés

Date : 2026-09-25
Fuseau de référence : **Africa/Porto-Novo (UTC+1)**
Statut : approuvé pour conception, en attente de revue finale

## Objectif

Empêcher toute fuite de contenu d’un examen avant son ouverture, rendre l’ouverture déterministe au jour J, contrôler le démarrage à l’heure prévue et automatiser l’ouverture par un cron protégé.

## Règles temporelles

- Stockage PostgreSQL : UTC (`timestamp without time zone`).
- Configuration applicative : `APP_TIMEZONE=Africa/Porto-Novo`.
- `opensOn` représente le début de la journée d’ouverture, interprété dans `APP_TIMEZONE`.
- `scheduledAt` représente l’heure effective de démarrage, stockée en UTC.
- Aucune comparaison de date ne doit utiliser le fuseau du navigateur ou celui de la machine hôte.

## Comportement

### Avant le jour J

Pour un examen planifié dont la journée d’ouverture est future :

- aucune description, aucun barème, aucune durée, aucun nombre de questions et aucun contenu ne sont renvoyés ;
- seuls l’identifiant, le titre, la date d’ouverture, l’heure prévue et le compte à rebours peuvent être exposés ;
- les routes `GET`, `start`, `draft` et `submit` refusent l’accès avec `423 EXAM_LOCKED` ;
- l’API publique ne déclenche plus de mutation.

### Le jour J

- À `00:00:00 Africa/Porto-Novo`, l’examen devient visible publiquement.
- Le compte à rebours continue de compter jusqu’à `scheduledAt`.
- Le bouton « Commencer » reste verrouillé avant l’heure prévue.
- Aucun contenu d’examen n’est exposé avant cette heure.

### À l’heure prévue

- `start` devient autorisé uniquement si l’examen est `ACTIVE`, published et si `scheduledAt <= now`.
- Le cron bascule une seule fois les examens `SCHEDULED` échus vers `PUBLISHED`.
- Le lazy-open reste un filet de sécurité interne, sans mutation depuis une route publique.

### Après ouverture

- `draft` et `submit` revérifient la disponibilité à chaque requête.
- Une session déjà commencée peut être reprise selon les règles de session existantes.
- `submit` refuse un examen archivé ou redeployé verrouillé.

## Champs et migration

Ajouter à `Exam` :

- `opensOn DateTime?`, date d’ouverture stockée en UTC et calculée à partir de la date locale Africa/Porto-Novo.

La migration doit être additive, idempotente et sans `DROP`, sans `UPDATE` massif et sans modification des sessions existantes.

Pour les examens existants :

- si `opensOn` est null, valeur de repli égale à la date locale de `scheduledAt` ;
- ne jamais modifier automatiquement un code ou un document attesté.

## Transitions admin autorisées

- `DRAFT -> SCHEDULED` avec `opensOn` et `scheduledAt` obligatoires ;
- `DRAFT -> PUBLISHED` uniquement si l’examen est immédiatement ouvert ;
- `SCHEDULED -> PUBLISHED` uniquement par le cron ou une action admin explicite ;
- `PUBLISHED -> ARCHIVED` ;
- `ARCHIVED` n’est pas réactivé automatiquement.

Un statut invalide ou une transition interdite renvoie `400`, jamais `500`.

## Cron interne

Créer `POST /api/internal/exams/open` :

- authentification `Authorization: Bearer $CRON_SECRET` ;
- aucune mutation si le secret est absent ou incorrect ;
- `updateMany` conditionnel et idempotent ;
- journal `AuditLog` pour chaque bascule ;
- invalidation du cache des examens ;
- aucune donnée publique révélée dans la réponse.

Exécution recommandée toutes les cinq minutes dans l’environnement Docker/VPS, via le superviseur ou un cron système protégé. Le workflow GitHub Actions ne doit pas être utilisé comme unique déclencheur si le VPS est la source de production.

## Cache et réponses publiques

- `getPublicUpcomingExams` doit retourner une forme réduite pour les examens futurs.
- Le cache doit être invalidé après création, modification et cron.
- `scheduledAt`, `opensOn` et `isAvailable` sont les seuls champs de planning exposés avant l’heure.
- Aucun `part*Questions`, `passingScore`, `totalPoints` ou `description` avant ouverture.

## Tests requis

- `tests/lib/exams/time.test.ts` : parsing UTC/Porto-Novo, minuit, jour J, DST si applicable.
- `tests/lib/exams/availability.test.ts` : J-1 verrouillé, J visible, J+1 verrouillé, start avant/après `scheduledAt`.
- `tests/api/user-exams-future-leak.test.ts` : absence de description, barème, durée et questions avant ouverture.
- `tests/api/exams-start.test.ts` : `423` avant jour J, `404` pour inexistant, démarrage à l’heure.
- `tests/api/exams-draft-eligibility.test.ts` : refus avant ouverture.
- `tests/api/exams-submit.test.ts` : refus si l’examen redevient verrouillé.
- `tests/api/admin-exam-status.test.ts` : statuts et transitions invalides en `400`.
- `tests/api/internal-open-exams.test.ts` : secret requis, idempotence, audit et cache.
- E2E : countdown et ouverture le jour J.

## Critères de sortie

- Aucun contenu d’examen futur n’est accessible.
- Le fuseau Africa/Porto-Novo est explicite dans la configuration et les tests.
- L’ouverture est idempotente, journalisée et reproductible.
- Le cron protège l’ouverture automatique.
- Les migrations et données historiques sont intactes.
- La CI quality/test/E2E est verte.
