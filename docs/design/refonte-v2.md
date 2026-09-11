# Refonte v2 — Direction design FSA

Pilote validé avant généralisation. Objectif : adopter le **langage** de `Design.md`
(formes arrondies, espaces généreux, énergie playful) sans cloner Pinterest, en le
remappant sur l'identité de la Ferme Agro-Piscicole St André (FSA).

Écrans pilotes : Accueil, Formations, Espace candidat.

---

## 1. Principe directeur

| Pinterest (`Design.md`) | FSA v2 |
|---|---|
| Rouge `#e60023` dominant | **Émeraude** dominant (déjà l'identité FSA) |
| `pinSans` propriétaire | **Inter** (déjà chargée via `next/font/google`) |
| Base d'espacement 6px | **Base 4px** (échelle Tailwind native) |
| Radius 16–50px uniformes | Radius généreux mais hiérarchisés (8 → 32px + pilule) |
| Ombres grises/dures | **Ombres teintées** douces (vert/slate) |
| Amateur/loisir | Chaleur terrienne + rigueur institutionnelle |

Ce qui est **repris** : canvas clair, coins arrondis, respiration, pastilles pilule,
dégradés doux, animations d'apparition orchestrées, énergie positive.

Ce qui est **rejeté** : rouge Pinterest, police propriétaire, règles typographiques
CJK, grille 6px, ombres `rgba(0,0,0,.45)`, absence de hiérarchie de radius.

---

## 2. Palette

Tokens ajoutés dans `app/globals.css` (aucun token existant supprimé/renommé).

### Primaires & accents

| Rôle | Nom | Hex | Utilitaire | Usage |
|---|---|---|---|---|
| Primaire | `--color-brand` | `#059669` | `bg-brand` / `text-brand` | CTA, liens, états actifs, identité |
| Primaire foncé | `--color-brand-strong` | `#047857` | `bg-brand-strong` | Hover/pressed du primaire |
| Primaire clair | `--color-brand-soft` | `#d1fae5` | `bg-brand-soft` | Fonds de badge, halos |
| Secondaire « océan » | `--color-ocean` | `#3b82f6` | `bg-ocean` | Examens, données, complémentaire froid |
| Secondaire foncé | `--color-ocean-strong` | `#2563eb` | `bg-ocean-strong` | Hover du secondaire |
| Accent « récolte » | `--color-harvest` | `#f59e0b` | `bg-harvest` | Mises en avant chaleureuses (stages, alertes douces) |

L'accent secondaire froid est l'**océan** (bleu), cohérent avec l'élevage
aquacole et déjà présent dans l'interface. L'**ambre** reste le seul accent
chaud, réservé aux mises en avant. Aucun rouge de marque.

### Neutres & surfaces

| Rôle | Nom | Hex | Utilitaire | Usage |
|---|---|---|---|---|
| Canvas | `--color-canvas` | `#f6f8f6` | `bg-canvas` | Fond de page (blanc cassé légèrement vert) |
| Surface | `--color-surface` | `#ffffff` | `bg-surface` | Cartes |
| Surface douce | `--color-surface-muted` | `#f1f5f3` | `bg-surface-muted` | Zones secondaires |
| Encre | `--color-ink` | `#0f172a` | `text-ink` | Titres, texte principal |
| Encre atténuée | `--color-ink-muted` | `#64748b` | `text-ink-muted` | Texte secondaire |
| Filet | `--color-line` | `#e2e8e4` | `border-line` | Bordures et séparateurs |

L'échelle `slate-*`, `emerald-*`, `blue-*`, `amber-*`, `rose-*` existante reste
utilisable ; les nouveaux tokens servent d'intention sémantique.

### Sémantiques

| Rôle | Couleur | Utilitaire | Usage |
|---|---|---|---|
| Succès | émeraude | `text-emerald-600` | Validation, réussite |
| Information | océan | `text-ocean` | Statut neutre, examen |
| Vigilance | ambre | `text-amber-600` | En attente, deadline proche |
| Erreur / révocation | rose | `text-rose-600` | Échec, document révoqué |

Le rose est toléré **uniquement** en sémantique d'erreur (contraste et convention),
jamais comme accent de marque ni comme CTA.

---

## 3. Typographie

**Famille : Inter** (conservée). Justification : déjà chargée via `next/font/google`
(donc zéro coût réseau additionnel), très lisible, disponible en graisses
variables et cohérente pendant la migration progressive des 65 pages.
*Piste phase 2 : « Plus Jakarta Sans » en display si le client veut marquer davantage
la refonte ; nécessiterait une modification de `app/layout.tsx` (hors périmètre pilote).*

### Échelle (base 4px, interlignage resserré sur les titres)

| Rôle | Taille | Graisse | Interlignage | Interlettrage |
|---|---|---|---|---|
| Display (hero) | `clamp(2.5rem, 6vw, 5rem)` | 800–900 | 0.95–1.05 | `-0.03em` |
| H1 | `2.25–3rem` | 800 | 1.1 | `-0.02em` |
| H2 | `1.75–2.25rem` | 800 | 1.15 | `-0.01em` |
| H3 | `1.25–1.5rem` | 700 | 1.25 | normal |
| Corps | `1rem` | 500 | 1.65 | normal |
| Petit / méta | `0.75–0.875rem` | 600 | 1.5 | `0.02em` |
| Étiquette | `0.625–0.75rem` | 800 | 1.2 | `0.15em` (majuscules) |

Les micro-étiquettes en majuscules restent utilisées pour les badges et les
surtitres de section, avec un interlettrage large pour un rendu premium.

---

## 4. Radius, ombres, espacement

### Radius (tokens additifs)

| Token | Valeur | Utilitaire | Usage |
|---|---|---|---|
| `--radius-control` | `0.75rem` (12px) | `rounded-control` | Inputs, petits boutons |
| `--radius-action` | `1rem` (16px) | `rounded-action` | Boutons, pastilles |
| `--radius-card` | `1.75rem` (28px) | `rounded-card` | Cartes standard |
| `--radius-panel` | `2.25rem` (36px) | `rounded-panel` | Grandes sections, héros |
| `--radius-pill` | `9999px` | `rounded-pill` | Badges, puces, filtres |

Règle : plus la surface est grande, plus le radius est grand. Les éléments
interactifs ne descendent pas sous 12px. Pas de coins droits.

### Ombres (teintées, jamais noir pur)

| Token | Utilitaire | Usage |
|---|---|---|
| `--shadow-soft` | `shadow-soft` | Repos des cartes |
| `--shadow-lifted` | `shadow-lifted` | Hover / survol |
| `--shadow-float` | `shadow-float` | Éléments flottants, hero |

Les ombres utilisent une teinte `rgb(6 78 59 / …)` (émeraude profonde) ou
`rgb(15 23 42 / …)` à faible opacité, pour rester douces et cohérentes.

### Espacement

Base **4px** (échelle Tailwind native : 1 = 4px). Rythme recommandé :
- Padding de carte : `1.5rem` → `2rem` (`p-6`/`p-8`)
- Écart dans une carte : `0.75rem` → `1rem`
- Écart entre cartes : `1rem` → `2rem`
- Entre sections : `4rem` → `6rem` (`py-16`/`py-24`)
- Largeur de contenu : `max-w-7xl` (1280px), gouttières `px-4`/`px-6`.

---

## 5. Règles composants

### Boutons
- **Primaire** : fond `brand`, texte blanc, `rounded-action` (ou `rounded-pill` en
  hero), hauteur ≥ 44px, ombre `shadow-soft` teintée. Au survol : `brand-strong`,
  `-translate-y-0.5`, ombre `shadow-lifted`. `active:scale-[0.98]`.
- **Secondaire** : fond blanc, bordure `line`, texte `ink`. Survol : fond
  `surface-muted`.
- **Fantôme / lien** : sans fond, texte `brand`, souligné au survol.
- Transition unique et rapide (`200–300ms`, `ease-out`). Jamais d'animation
  décorative permanente sur un bouton.

### Cartes
- Fond `surface`, bordure `line` (1px) ou `border-transparent`, `rounded-card`.
- Ombre `shadow-soft` au repos, `shadow-lifted` au survol.
- Décalage vertical léger au survol (`hover:-translate-y-1`) maximum.
- Contenu : titre `ink` en graisse 800, corps `ink-muted`.

### Badges / pastilles
- `rounded-pill`, texte `0.625–0.75rem` en graisse 800, majuscules.
- Variantes : succès (fond `brand-soft` / texte `brand-strong`), info (bleu),
  vigilance (ambre), erreur (rose). Toujours avec un pictogramme si l'état est
  critique.

### Inputs
- Fond blanc, bordure `line`, `rounded-control`, hauteur ≥ 44px.
- Focus : bordure `brand` + anneau `ring-4 ring-brand/10`. Pas de contour par
  défaut du navigateur.
- Placeholder `ink-muted`.

### Liens
- Texte `brand-strong` ; soulignement à l'apparition au survol (`underline-offset-4`).
- Les zones cliquables entières (cartes-liens) doivent avoir un état de survol
  visible et un focus clavier (`focus-visible:ring`).

### Mouvement
- Apparitions orchestrées au chargement (`animate-rise` + `animation-delay`
  échelonné), durée 600–800ms, courbe `cubic-bezier(0.22, 1, 0.36, 1)`.
- Un seul temps fort par écran ; les micro-interactions restent discrètes.
- `prefers-reduced-motion: reduce` désactive animations et transitions.

### Accessibilité
- Cibles tactiles ≥ 44px, contrastes texte ≥ 4.5:1.
- Anneaux de focus conservés sur tous les éléments interactifs.
- Aucune information portée uniquement par la couleur (icône + libellé).

---

## 6. Application aux écrans pilotes

1. **Accueil** (`app/(public)/page.tsx` + composants) : hero allégé, blobs
   organiques discrets, badges pilule, cartes d'accès rapide arrondies, parcours
   « Comment ça marche » en onglets segmentés.
2. **Formations** (`FormationsClient.tsx`) : recherche et filtres conservés,
   puces pilule, cartes de programme en `rounded-card`, palette par catégorie
   alignée sur la direction (émeraude / océan / ambre).
3. **Espace candidat** (`app/(user)/dashboard/page.tsx`) : hiérarchie clarifiée,
   carte d'accueil en dégradé émeraude profond, statistiques en tuiles douces,
   remplacement des indigo/violet par océan/émeraude, suppression des emojis.
