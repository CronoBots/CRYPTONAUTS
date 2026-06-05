# installer-remote-control.ps1
# À LANCER UNE SEULE FOIS sur votre PC (PowerShell NORMAL, pas besoin d'admin),
# dans le dossier du dépôt.
#
# Installe un lanceur dans le dossier "Démarrage" de Windows qui :
#   - démarre Claude Remote Control automatiquement à chaque ouverture de session
#     (donc au démarrage du PC),
#   - tourne en arrière-plan SANS fenêtre (survit à la fermeture de PowerShell),
#   - se relance tout seul s'il s'arrête (via remote-control-loop.ps1).
#
# Aucune élévation administrateur requise (méthode dossier Démarrage utilisateur).
#
# Usage :  powershell -ExecutionPolicy Bypass -File .\installer-remote-control.ps1
#
# Pour DÉSINSTALLER plus tard : supprimez le fichier .vbs indiqué à la fin,
# puis fermez la session via le Gestionnaire des tâches (ou redémarrez).

$ErrorActionPreference = "Stop"

$projectDir = $PSScriptRoot
$loopScript = Join-Path $projectDir "remote-control-loop.ps1"

if (-not (Test-Path $loopScript)) {
    Write-Error "remote-control-loop.ps1 introuvable dans $projectDir. Faites d'abord 'git pull origin main'."
    exit 1
}

# Dossier Démarrage de l'utilisateur (pas besoin d'admin)
$startupDir = [Environment]::GetFolderPath('Startup')
$vbsPath    = Join-Path $startupDir "claude-remote-control-cryptonauts.vbs"

# Le .vbs lance PowerShell en fenêtre totalement cachée (style 0 = invisible)
$vbs = @"
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = "$projectDir"
sh.Run "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File ""$loopScript""", 0, False
"@

Set-Content -Path $vbsPath -Value $vbs -Encoding ASCII
Write-Host "[OK] Lanceur de demarrage cree :" -ForegroundColor Green
Write-Host "     $vbsPath" -ForegroundColor Green

# Démarre tout de suite (sans attendre le prochain redémarrage)
Start-Process "wscript.exe" -ArgumentList "`"$vbsPath`""
Write-Host "[OK] Remote Control demarre en arriere-plan." -ForegroundColor Green
Write-Host ""
Write-Host "Vous pouvez fermer cette fenetre : la session continue de tourner." -ForegroundColor Cyan
Write-Host "Retrouvez-la sur https://claude.ai/code (session 'Cryptonauts')." -ForegroundColor Cyan
Write-Host ""
Write-Host "Pour desinstaller : supprimez le fichier" -ForegroundColor DarkGray
Write-Host "  $vbsPath" -ForegroundColor DarkGray
