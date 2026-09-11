# Spec — Page d'inscription publique (`/inscription`)

Date : 2026-09-11
Domaine : `https://hashcode.cloud` (app FSA)

## Contexte

- Le login est `/auth` (page unifiée, onglets « Mot de passe » et « Code FSA & OTP »).
- `PublicHeader` et `/auth` affichent déjà « Inscription » / « Créer un compte » → `/inscription`.
- `app/(public)/inscription/page.tsx` est **corrompu** (33 356 octets de `\0`, non tracké git) → la route renvoie **404**. Résultat : seule l'interface de connexion est visible.
- Le backend Better Auth est actif (`/api/auth/sign-up/email`), la vérification email par OTP est configurée (`emailOTP` + `overrideDefaultEmailVerification: true`), et `/api/user/after-signup` existe (hors périmètre ici).
- Config auth conteneur : `BETTER_AUTH_URL` et `NEXT_PUBLIC_APP_URL` = `https://hashcode.cloud` (correct).

## Objectif

Rétablir une page d'inscription publique fonctionnelle à `/inscription`, cohérente visuellement avec `/auth`.

## Non-objectifs (YAGNI)

- Pas de champs enrichis (téléphone, naissance, adresse, formation) — parcours strict minimal choisi.
- Pas de case CGU dédiée (les liens légaux restent dans le footer).
- Pas de rôle au choix : le compte est créé avec le rôle par défaut `user`.
- Aucun changement backend / schéma Prisma.

## Parcours retenu — 2 étapes

### Étape 1 — Créer le compte
Champs et validation (Zod) :
- `name` : min 2 caractères
- `email` : email valide
- `password` : min 8 caractères
- `confirmPassword` : doit être identique à `password`

Appel client :
```ts
authClient.signUp.email({ name, email, password })
```
> **Sans** `role` (ne pas reprendre l'ancienne page `app/admin/register` qui forçait `role: "admin"`).

En cas de succès → étape 2.

### Étape 2 — Vérifier l'email (OTP 6 chiffres)
- Message « Un code à 6 chiffres a été envoyé à `<email>` ».
- Champ `otp` : exactement 6 chiffres.
- Vérification :
```ts
authClient.emailOtp.verifyEmail({ email, otp })
```
- Puis connexion explicite et redirection :
```ts
authClient.signIn.email({ email, password, callbackURL: "/dashboard" })
router.push("/dashboard")
```
- Bouton « Renvoyer le code » : `authClient.emailOtp.sendVerificationOtp({ email, type: "email-verification" })`, avec cooldown (30 s) et état `resending`.
- Lien « Déjà un compte ? Se connecter » → `/auth`.

## Gestion d'erreurs / UX

- Traduction des messages via `translateAuthError` (`@/lib/error-translator`).
- Toasts `sonner` (succès/erreur).
- États : `loading`, `isRedirecting`, `resending`, `resendCooldown`, `fieldErrors`.
- Cas : email déjà utilisé, mot de passe trop court, mots de passe différents, OTP invalide/expiré, réponses réseau.
- Empêcher le double-submit.

## Design / intégration

- Reproduire le langage visuel de `app/(public)/auth/page.tsx` : fond `#fafbfc`, blobs flous, cartes `rounded-[2.5rem]`, dégradés émeraude/bleu, `framer-motion`, icônes `lucide-react`, typo `font-black uppercase tracking-widest` pour les boutons.
- Responsive (mobile/desktop), accessible (labels, `autoComplete`, focus, aria sur erreurs).

## Fichiers

- Modifier/écraser : `app/(public)/inscription/page.tsx`
- Aucun autre fichier requis (liens déjà présents dans `PublicHeader.tsx` et `/auth`).

## Déploiement

L'image en ligne (`attestations-fsa-fsa-app`) est antérieure. Rebuild + recreate :
```bash
cd /home/audest/attestations-fsa
docker compose --env-file .env.production -f compose.prod.yml up -d --build fsa-app
```

## Vérification

1. `docker exec attestations-fsa-prod wget -qO- http://127.0.0.1:3000/inscription` contient le formulaire (ou code HTTP 200 sur la route).
2. `curl -s -o /dev/null -w '%{http_code}' https://hashcode.cloud/inscription` → **200** (plus 404).
3. Le lien « Créer un compte » sur `/auth` et « Inscription » dans le header mènent à la page.
4. Test fonctionnel manuel : inscription avec un email réel → réception OTP → vérification → arrivée sur `/dashboard`.
5. `docker logs attestations-fsa-prod` sans erreur au chargement de la page.

## Risques

- **OTP obligatoire** : sans email reçu, l'utilisateur ne peut pas se connecter (config production). Le bouton « Renvoyer » doit fonctionner.
- L'image doit être reconstruite : modifier le fichier ne suffit pas.
