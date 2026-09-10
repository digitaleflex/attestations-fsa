#!/usr/bin/env bash
set -euo pipefail

# Fichiers .env autorisés : seul le modèle canonique (.env.local et
# .env.production sont locaux, ignorés par git et donc invisibles ici)
ALLOWED=(
  .env.example
)

# Pattern strict : .env.local, .env.example, .env.production
# Exclut les dossiers comme .envsitter/
PATTERN='^\.env(\..*)?$'

# Fichiers .env suivis
TRACKED="$(git ls-files | grep -E "$PATTERN" || true)"

# Fichiers .env non suivis
UNTRACKED="$(git ls-files --others --exclude-standard | grep -E "$PATTERN" || true)"

ALL=()
if [[ -n "$TRACKED" ]]; then
  while IFS= read -r f; do ALL+=("$f"); done <<< "$TRACKED"
fi
if [[ -n "$UNTRACKED" ]]; then
  while IFS= read -r f; do ALL+=("$f"); done <<< "$UNTRACKED"
fi

FOUND=0
for f in "${ALL[@]}"; do
  MATCH=0
  for a in "${ALLOWED[@]}"; do
    if [[ "$f" == "$a" ]]; then
      MATCH=1
      break
    fi
  done
  if [[ "$MATCH" -eq 0 ]]; then
    echo "Erreur: fichier .env non autorisé détecté: $f"
    FOUND=1
  fi
done

if [[ "$FOUND" -eq 0 ]]; then
  echo "Aucun fichier .env non autorisé détecté"
fi

exit $FOUND