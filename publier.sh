#!/usr/bin/env bash
# publier.sh — À LANCER SUR VOTRE PC (Git Bash / macOS / Linux), dans le dépôt.
#
# Flux « à la demande » : install -> Test.js écrit index.html -> commit + push.
# Test.js refuse d'écrire si 0 propriétaire récupéré (garde-fou anti-vide) et
# sort en erreur ; grâce à `set -e` le script s'arrête alors avant de publier.
#
# Usage :  ./publier.sh
set -euo pipefail
cd "$(dirname "$0")"

echo "[publier] 1/3 Installation des dépendances..."
npm install

echo "[publier] 2/3 Génération de index.html via Test.js..."
node Test.js

echo "[publier] 3/3 Commit + push sur main..."
git add index.html
if git diff --cached --quiet; then
  echo "[publier] Aucun changement dans index.html — rien à publier."
else
  git commit -m "Update Cryptonauts leaderboards (regenerated index.html)"
  git pull --rebase origin main
  git push origin main
  echo "[publier] Terminé — index.html publié sur GitHub."
fi
