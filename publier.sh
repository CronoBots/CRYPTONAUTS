#!/usr/bin/env bash
# publier.sh — À LANCER SUR VOTRE PC (Git Bash / macOS / Linux), dans le dépôt.
#
# Cycle complet : install -> génère -> garde-fou anti-vide -> index.html -> push.
#
# Usage :  ./publier.sh
set -euo pipefail
cd "$(dirname "$0")"

echo "[publier] 1/5 Installation des dépendances..."
npm install

echo "[publier] 2/5 Génération via Test.js..."
node Test.js

echo "[publier] 3/5 Vérification du résultat..."
if [ ! -f Cryptonauts.html ]; then
  echo "ERREUR : Cryptonauts.html n'a pas été généré. Abandon." >&2
  exit 1
fi
size=$(wc -c < Cryptonauts.html)
if [ "$size" -lt 50000 ]; then
  echo "ERREUR : Cryptonauts.html ne fait que $size octets : données probablement vides (API bloquée / 403 ?)." >&2
  echo "Publication ANNULÉE pour ne pas écraser le site." >&2
  exit 1
fi
echo "[publier]   OK ($size octets)"

echo "[publier] 4/5 Mise à jour de index.html..."
cp Cryptonauts.html index.html

echo "[publier] 5/5 Commit + push sur main..."
git add index.html
git commit -m "Update Cryptonauts leaderboards (regenerated index.html)"
git pull --rebase origin main
git push origin main

echo "[publier] Terminé — index.html publié sur GitHub."
