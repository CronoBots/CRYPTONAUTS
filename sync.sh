#!/usr/bin/env bash
#
# sync.sh — Garde votre copie locale du dépôt Cryptonauts synchronisée
# avec GitHub (le travail fait dans Claude Code on the web est poussé sur
# GitHub, ce script le récupère sur VOTRE PC).
#
# À LANCER SUR VOTRE PC (pas dans le conteneur cloud).
#
# Usage :
#   ./sync.sh                 # met à jour une fois (clone si absent)
#   ./sync.sh --watch         # met à jour automatiquement toutes les 60s
#   ./sync.sh --watch 30      # met à jour automatiquement toutes les 30s
#   BRANCH=main ./sync.sh     # choisir la branche (défaut: main)
#
set -euo pipefail

# ----- Configuration (modifiable via variables d'environnement) -----
REPO_URL="${REPO_URL:-https://github.com/CronoBots/Cryptonauts.git}"
BRANCH="${BRANCH:-main}"
TARGET_DIR="${TARGET_DIR:-Cryptonauts}"

log() { printf '\033[1;34m[sync]\033[0m %s\n' "$*"; }
err() { printf '\033[1;31m[sync]\033[0m %s\n' "$*" >&2; }

clone_or_enter() {
  if [ ! -d "$TARGET_DIR/.git" ]; then
    log "Clonage initial de $REPO_URL dans ./$TARGET_DIR ..."
    git clone "$REPO_URL" "$TARGET_DIR"
  fi
  cd "$TARGET_DIR"
}

update_once() {
  # S'assure d'être sur la bonne branche
  git fetch origin "$BRANCH"
  if git rev-parse --verify "$BRANCH" >/dev/null 2>&1; then
    git checkout "$BRANCH" >/dev/null 2>&1
  else
    git checkout -b "$BRANCH" "origin/$BRANCH" >/dev/null 2>&1
  fi

  local before after
  before="$(git rev-parse HEAD)"
  git pull --ff-only origin "$BRANCH"
  after="$(git rev-parse HEAD)"

  if [ "$before" != "$after" ]; then
    log "Mise à jour : $before -> $after"
    git --no-pager log --oneline "$before..$after"
  else
    log "Déjà à jour ($BRANCH)."
  fi
}

main() {
  clone_or_enter

  if [ "${1:-}" = "--watch" ]; then
    local interval="${2:-60}"
    log "Surveillance activée (branche '$BRANCH', toutes les ${interval}s). Ctrl+C pour arrêter."
    while true; do
      update_once || err "Échec de la mise à jour, nouvelle tentative dans ${interval}s."
      sleep "$interval"
    done
  else
    update_once
    log "Terminé."
  fi
}

main "$@"
