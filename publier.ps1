# publier.ps1 — À LANCER SUR VOTRE PC (PowerShell), dans le dossier du dépôt.
#
# Fait tout le cycle :
#   1. installe les dépendances (axios)
#   2. lance Test.js (génère Cryptonauts.html via l'API crypto.com)
#   3. garde-fou : refuse de publier si le résultat est vide (ex. 403)
#   4. copie Cryptonauts.html -> index.html
#   5. commit + push sur main
#
# Usage :  powershell -ExecutionPolicy Bypass -File .\publier.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "[publier] 1/5 Installation des dependances..." -ForegroundColor Cyan
npm install

Write-Host "[publier] 2/5 Generation via Test.js..." -ForegroundColor Cyan
node Test.js

Write-Host "[publier] 3/5 Verification du resultat..." -ForegroundColor Cyan
if (-not (Test-Path Cryptonauts.html)) {
    Write-Error "Cryptonauts.html n'a pas ete genere. Abandon."
    exit 1
}
$size = (Get-Item Cryptonauts.html).Length
if ($size -lt 50000) {
    Write-Error "Cryptonauts.html ne fait que $size octets : donnees probablement vides (API bloquee / 403 ?). Publication ANNULEE pour ne pas ecraser le site."
    exit 1
}
Write-Host "[publier]   OK ($size octets)" -ForegroundColor Green

Write-Host "[publier] 4/5 Mise a jour de index.html..." -ForegroundColor Cyan
Copy-Item Cryptonauts.html index.html -Force

Write-Host "[publier] 5/5 Commit + push sur main..." -ForegroundColor Cyan
git add index.html
git commit -m "Update Cryptonauts leaderboards (regenerated index.html)"
git pull --rebase origin main
git push origin main

Write-Host "[publier] Termine - index.html publie sur GitHub." -ForegroundColor Green
