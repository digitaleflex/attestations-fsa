# Glossaire UX — Terminologie produit FSA (issue #351)

Vocabulaire unique des parcours publics. Chaque terme décrit le
fonctionnement réel de la plateforme : le copy ne change jamais le sens
métier. Référence pour les écrans publics et les messages de succès/erreur.

## Définitions opérationnelles

| Terme | Sens opérationnel | Où l'utiliser |
|---|---|---|
| **Formation** | Contenu du catalogue public (`/formations`) : domaine, programme, compétences annoncées. | Accueil, catalogue, contact. |
| **Session** | Créneau d'examen daté et public (`/examens`) : date, durée, statut (`ouverte`, `à venir`, `close`). Une session appartient à une formation. | Accueil (étape 02), examens. |
| **Préinscription** | Demande d'intérêt pour une formation, envoyée via `/formations/inscription`. Elle **ne vaut pas inscription définitive** : l'équipe FSA doit la confirmer. Toujours l'accompagner de cette réserve. | Accueil, formations, contact (`Demande de préinscription`). |
| **Inscription (compte)** | Création du compte candidat (`/inscription`, vérification e-mail). Sans compte, pas d'accès aux examens. | Auth, accueil (étape 03). |
| **Demande** | Message formulé par un visiteur et transmis à l'équipe FSA : demande de stage (`/demande-stage`), message (`/contact`). Succès : **« demande reçue »**. | Stage, contact, confirmations. |
| **Candidature** | Synonyme de **demande de stage**, réservé au parcours stage (CV + motivations). Ne pas l'utiliser pour les formations ni le compte. | `/demande-stage` uniquement. |
| **Examen** | Épreuve en ligne passée depuis l'espace candidat, rattachée à une session ouverte. | Examens, espace candidat. |
| **Résultat** | Issue d'un examen (score, réussite) consultable dans l'espace candidat. | Espace candidat. |
| **Attestation** | Document officiel émis après validation du dossier. Porte un **code unique** imprimé dessus. | Vérification, espace candidat. |
| **Vérification** | Contrôle public d'authenticité d'une attestation à partir de son code (`/verifier`). Gratuite, sans compte. | Vérification, accueil, FAQ. |
| **Révocation** | Invalidation d'une attestation déjà émise (statut `REVOKED`). Distincte du refus d'émission (`REJECTED`) : le tiers vérifie une révocation, jamais un document valide. | Vérification (état « révoquée »). |
| **Compte candidat** | Espace personnel obtenu après inscription : examens, résultats, attestations. Terme préféré à « mon espace » dans les CTA. | Accueil, examens, auth. |

## Règles d'application

- Un écran = **une action primaire unique**, formulée avec le terme du glossaire
  (« Explorer les formations », « Vérifier », « Envoyer ma demande »).
- « Préinscription » n'implique jamais une inscription définitive.
- Les confirmations disent « demande reçue » quand c'est une demande.
- Les états de vérification ne reposent jamais sur la seule couleur :
  `valide`, `révoquée`, `introuvable`, `vérification impossible` (problème technique).
- La vérification confirme que le code correspond à une attestation émise par
  la FSA et si elle est toujours valable. Elle ne confirme ni l'identité de la
  personne qui présente le document, ni le détail du parcours suivi.
- Ton sobre et conforme : aucune promesse de délai ou de résultat non prévue
  par le fonctionnement réel (pas de « instantanément », pas de « sous 24 h »).

## Occurrences restantes connues (hors périmètre de ce chantier)

- `app/(public)/formations/inscription/FormInscription.tsx` : bouton
  « Envoyer ma candidature » — devrait dire « Envoyer ma demande de
  préinscription » (dossier `formations/*` exclu du périmètre).
- `app/(public)/auth/*`, `app/(public)/inscription/*` : inchangés (exclus).
