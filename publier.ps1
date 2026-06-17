# publier.ps1 — À LANCER SUR VOTRE PC (PowerShell), dans le dossier du dépôt.
#
# Flux « à la demande » :
#   1. installe les dépendances (axios)
#   2. lance Test.js : interroge l'API crypto.com et écrit DIRECTEMENT index.html
#      (Test.js refuse d'écrire si 0 propriétaire récupéré → garde-fou anti-vide,
#       il sort alors en erreur et la publication est annulée)
#   3. commit + push de index.html sur main (seulement s'il a changé)
#
# Usage :  powershell -ExecutionPolicy Bypass -File .\publier.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "[publier] 1/3 Installation des dependances..." -ForegroundColor Cyan
npm install

Write-Host "[publier] 2/3 Generation de index.html via Test.js..." -ForegroundColor Cyan
node Test.js
if ($LASTEXITCODE -ne 0) {
    Write-Error "Test.js a echoue (donnees vides / API bloquee / 403 ?). index.html non modifie. Publication ANNULEE."
    exit 1
}

Write-Host "[publier] 3/3 Commit + push sur main..." -ForegroundColor Cyan
git add index.html
if (git status --porcelain index.html) {
    git commit -m "Update Cryptonauts leaderboards (regenerated index.html)"
    git pull --rebase origin main
    git push origin main
    Write-Host "[publier] Termine - index.html publie sur GitHub." -ForegroundColor Green
} else {
    Write-Host "[publier] Aucun changement dans index.html - rien a publier." -ForegroundColor Yellow
}
