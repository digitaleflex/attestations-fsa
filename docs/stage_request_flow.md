# Flux de la demande de stage

## 1. Page de formulaire (`/demande‑stage`)
- Le composant **`InternshipApplicationPage`** (dans `app/(public)/demande-stage/page.tsx`) affiche le formulaire.
- Champs : nom complet, email, téléphone, université, niveau d'études, poste souhaité, **téléchargement du CV (PDF)**, message de motivation.
- Le champ CV est géré via `cvFile` (type `File | null`).
- À la soumission, le fichier est converti en **Base64** puis envoyé dans le corps JSON sous la clé `cvUrl`.

## 2. Route API (`/api/public/internships`)
- Méthode : **POST**.
- Reçoit le payload JSON contenant les informations du candidat ainsi que `cvUrl` (Base64 du PDF).
- La route se trouve dans `app/api/public/internships/route.ts` (à créer si absent).
- Elle valide les champs, stocke la candidature en base de données (ou envoie un email) et renvoie `200 OK`.

## 3. Retour utilisateur
- Si la requête réussit, le composant montre une **page de confirmation** avec un message de remerciement et un bouton « Retour à l'accueil ».
- En cas d’erreur, un toast d’erreur (`toast.error`) s’affiche.

## 4. Routes correspondantes
| Route | Méthode | Description |
|------|--------|-------------|
| `/demande-stage` | GET | Affiche le formulaire de candidature. |
| `/api/public/internships` | POST | Reçoit les données du formulaire, sauvegarde la candidature. |
| `/` (accueil) | GET | Page d’accueil du site. |

## 5. Scénario « tout se passe bien »
1. L'utilisateur remplit le formulaire et téléverse son CV.
2. Le bouton **Envoyer ma demande** déclenche `handleSubmit`.
3. Le fichier est converti en Base64, le payload est envoyé à `/api/public/internships`.
4. Le serveur répond `200 OK`.
5. Le composant passe `submitted` à `true` et affiche la page de confirmation.
6. L'utilisateur clique sur **Retour à l'accueil** et est redirigé vers `/`.

---
*Cette documentation peut être utilisée pour les tests d’intégration ou pour mettre à jour le README du projet.*
