# Synchronisation PC ↔ dépôt distant (Cryptonauts)

Ce document explique comment garder une **copie locale du dépôt sur votre PC**
synchronisée avec le travail effectué dans **Claude Code on the web** (le
conteneur cloud où Claude travaille). C'est le même principe que pour vos
projets « pronostic » et « sport api ».

## Le principe en une phrase

Le conteneur cloud est **éphémère et isolé** : il n'y a pas de tunnel de
contrôle direct vers votre PC. Le seul pont fiable est **Git via GitHub** :

```
Conteneur cloud (Claude)  --push-->  GitHub  --pull-->  Votre PC
```

Claude pousse son travail sur la branche `main`. Votre PC récupère ces
changements avec `git pull` (ou automatiquement avec le script `sync.sh`).

## Prérequis sur votre PC

- **Git** installé : https://git-scm.com/downloads
- Un accès au dépôt `CronoBots/Cryptonauts` (compte GitHub avec les droits).

## Étape 1 — Première installation (une seule fois)

Ouvrez un terminal sur votre PC, placez-vous où vous voulez la copie, puis :

```bash
# Télécharger le script (ou copiez sync.sh depuis le dépôt)
git clone https://github.com/CronoBots/Cryptonauts.git
cd Cryptonauts
```

## Étape 2 — Mettre à jour à la demande

À chaque fois que vous voulez récupérer le dernier travail :

```bash
git pull origin main
```

## Étape 3 (recommandé) — Mise à jour automatique avec `sync.sh`

Le script `sync.sh` (à la racine du dépôt) automatise le clone + la mise à
jour. Lancez-le **depuis votre PC**, dans le dossier *parent* de la copie :

```bash
# Rendre le script exécutable (une fois)
chmod +x sync.sh

# Mettre à jour une fois
./sync.sh

# OU : surveiller en continu et se mettre à jour toutes les 60 secondes
./sync.sh --watch

# OU : intervalle personnalisé (ex : toutes les 30 secondes)
./sync.sh --watch 30
```

Le script :
- clone le dépôt automatiquement s'il n'existe pas encore ;
- se place sur la branche `main` ;
- fait un `git pull --ff-only` et affiche les nouveaux commits récupérés.

### Variables d'environnement

| Variable     | Défaut                                              | Rôle                          |
|--------------|-----------------------------------------------------|-------------------------------|
| `BRANCH`     | `main`                                              | Branche à suivre              |
| `REPO_URL`   | `https://github.com/CronoBots/Cryptonauts.git`      | URL du dépôt                  |
| `TARGET_DIR` | `Cryptonauts`                                       | Dossier local de destination  |

Exemple :

```bash
BRANCH=main TARGET_DIR=~/projets/Cryptonauts ./sync.sh --watch 30
```

## Windows

- **Git Bash** (fourni avec Git pour Windows) : les commandes ci-dessus
  fonctionnent telles quelles.
- **PowerShell** sans Git Bash : utilisez directement les commandes Git
  (`git clone`, `git pull origin main`), le script `.sh` nécessite bash.

## Notes importantes

- Tout ce qui n'est **pas commité + poussé** dans le conteneur cloud est
  perdu quand le conteneur est recyclé. Le travail visible sur votre PC est
  donc uniquement ce qui a été poussé sur GitHub.
- Si vous modifiez **aussi** des fichiers en local, `git pull --ff-only`
  refusera de fusionner en cas de conflit : gérez vos changements locaux
  (commit/stash) avant de synchroniser.
- Documentation officielle de l'environnement :
  https://code.claude.com/docs/en/claude-code-on-the-web
