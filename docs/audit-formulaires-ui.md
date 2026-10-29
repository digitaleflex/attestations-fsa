# Audit formulaires & UI — attestations-fsa

Date : 2026-10-29 (VPS `axiom`). Périmètre : tous les formulaires `app/` + `components/`, validation client/serveur, états, a11y, promesses légales vs UI réelle.

## Verdict

**Parcours candidat et public : complets.** Inscription, connexion, reset, contact, demande de stage, signalement, vérification, examen, profil : validation, erreurs, chargement, succès tous présents.
**Admin : fonctionnel**, avec 3 écarts d'accessibilité mineurs.
**1 vrai trou : le RGPD promet en UI ce qui n'existe qu'en API.**

## ✅ Ce qui est complet (rien à faire)

| Formulaire | Points vérifiés |
|---|---|
| Inscription | zod, OTP 6 chiffres, resend 30 s, clickwrap CGU + case marketing décochée, consentements horodatés non-bloquants |
| Connexion | 3 flux (mot de passe, code FSA, OTP), zod, erreurs par champ, `aria-invalid/describedby`, autocomplete |
| Mot de passe oublié / reset (public) | zod, distinction code expiré/invalide, bouton « Recommencer », succès |
| Contact | zod serveur, erreurs inline renvoyées par l'API, résumé d'erreur focalisé, pré-remplissage depuis formation |
| Demande de stage | validation client, drag-drop PDF ≤ 3 Mo, serveur : zod + magic bytes + sanitize + rétention 365 j |
| Vérifier attestation | zod, `role="alert"`, autocomplete off |
| Préinscription formation | react-hook-form + zod, résumé d'erreurs, `mode: onBlur` |
| Examen candidat | timer, autosave serveur + localStorage, reprise brouillon, dialogue de confirmation, soumission auto à 0:00, annonces a11y |
| Création/édition examen (admin) | wizard 4 étapes, validation par étape bloquante, `role="alert"`, fuseau Africa/Porto-Novo corrigé |
| Création attestation (admin) | brouillon autosauvé, progression, erreurs par champ depuis l'API |
| Utilisateurs (admin) | CRUD, assignation examen, suppression = anonymisation RGPD (`app/api/users/[id]`) |
| Corrections/copies (admin) | notation, génération attestation, avertissement si attestation non générée |

## 🔴 Trou n° 1 — RGPD : promesses sans UI (prioritaire)

La page `/legal/confidentialite` promet : **droit d'accès, portabilité, effacement**. Or :
- `GET /api/user/export` **existe mais aucun bouton ne l'appelle** (aucune référence dans `app/` ni `components/`).
- Pas de case/interrupteur **marketing** dans le profil alors que `POST /api/user/consent` sait le révoquer.
- Pas de **demande de suppression** côté candidat (l'admin peut anonymiser, le candidat doit deviner qu'il faut écrire au support).
- Les **18 comptes pré-existants n'ont aucune ligne `Consent`** (point déjà ouvert) : aucun bandeau ne les invite à régulariser.

Concrètement : un utilisateur qui lit la politique de confidentialité ne peut exercer aucun droit en autonomie.

## 🟡 Écarts mineurs (a11y / UX)

1. **Profil candidat, « Changer mon mot de passe »** (`app/(user)/profile/page.tsx:447-469`) : `<Label>` sans `htmlFor`, inputs sans `id` ni `autocomplete` (`current-password` / `new-password`), pas de longueur min côté client.
2. **Admin Paramètres** (`app/admin/settings/page.tsx:228-389`) : 9 champs avec `<label>` non associé (pas de `htmlFor`/`id`) — lecteurs d'écran aveugles.
3. **`autocomplete` manquant** : contact (nom/email/tél), demande-stage, email du signalement, nom/email de la préinscription formation.
4. **Reset public** : pas de bouton « Renvoyer le code » direct (contournement : « Recommencer la demande » — acceptable, à uniformiser).
5. **Admin auth** (`login/forgot/reset`) : ancienne charte (Card/Alert) vs `AuthLayout` public, pas de distinction d'erreur OTP côté admin — cosmétique + messages bruts.

## 🟢 Non-problèmes vérifiés

- Export `after-signup` : `await` + toast d'erreur non-bloquant, pas de fire-and-forget silencieux.
- Durée d'examen : le `3600` initial est un fallback, la vraie durée vient du serveur (`/start`).
- Pas de `beforeunload` sur l'examen : couvert par l'autosave (serveur + local).
- Pas de `error.tsx` sous `(user)` : `global-error.tsx` + toasts couvrent ; `admin/loading.tsx` seul skeleton de route — acceptable.
- Sidebar admin mobile : `SidebarTrigger` (hamburger 44 px) présent dans le header — OK.

## Actions proposées (sans risque, UI uniquement)

| # | Action | État au 2026-10-29 |
|---|---|---|
| 1 | Section « Mes données » dans le profil : bouton export (télécharge le JSON de `/api/user/export`), interrupteur marketing (`/api/user/consent`), lien « demander la suppression » (pré-remplit le contact) | ✅ Fait — `app/(user)/profile/page.tsx`, `app/(public)/contact/page.tsx` (option + pré-remplissage `?subject=suppression`), `app/(public)/legal/confidentialite/page.tsx` alignée |
| 2 | Bandeau régularisation consentements pour les 18 comptes sans ligne `Consent` | ✅ Fait — `components/ConsentBanner.tsx` (clickwrap : le clic sur « J'ai compris » vaut acceptation, aucune case), affiché sur le tableau de bord |
| 3 | Associer labels + `autocomplete` (profil mot de passe, settings admin, formulaires publics) | Ouvert |
| 4 | `maxlength` côté client alignés sur les schémas zod (contact, signalement, notifications) | Ouvert |

Zéro migration, zéro nouvelle route API : tout repose sur `/api/user/export`, `/api/user/consent` et
`/api/user/after-signup` existants. La demande de suppression transite par le formulaire de contact
(sujet « suppression », tracé dans `/admin/contacts`), l'anonymisation restant côté admin.
