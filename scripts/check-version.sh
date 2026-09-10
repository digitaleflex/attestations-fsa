#!/usr/bin/env bash
set -euo pipefail

VERSION="$(node -p "require('./package.json').version")"

if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Erreur: version invalide: $VERSION"
  exit 1
fi

echo "Version valide: $VERSION"
