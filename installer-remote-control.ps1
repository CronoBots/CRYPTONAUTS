# installer-remote-control.ps1
# À LANCER UNE SEULE FOIS sur votre PC (PowerShell), dans le dossier du dépôt.
#
# Installe une tâche planifiée Windows qui :
#   - démarre Claude Remote Control automatiquement à chaque ouverture de session
#     (donc au démarrage du PC),
#   - tourne en arrière-plan SANS fenêtre (survit à la fermeture de PowerShell),
#   - se relance toute seule si elle s'arrête (via remote-control-loop.ps1).
#
# Usage :  powershell -ExecutionPolicy Bypass -File .\installer-remote-control.ps1
#
# Pour DÉSINSTALLER plus tard :
#   Unregister-ScheduledTask -TaskName "Claude Remote Control - Cryptonauts" -Confirm:$false

$ErrorActionPreference = "Stop"

$projectDir = $PSScriptRoot
$taskName   = "Claude Remote Control - Cryptonauts"
$loopScript = Join-Path $projectDir "remote-control-loop.ps1"

if (-not (Test-Path $loopScript)) {
    Write-Error "remote-control-loop.ps1 introuvable dans $projectDir. Faites d'abord 'git pull origin main'."
    exit 1
}

# Action : lance le script de boucle dans une fenêtre PowerShell cachée
$action = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$loopScript`"" `
    -WorkingDirectory $projectDir

# Déclencheur : à chaque ouverture de session Windows
$trigger = New-ScheduledTaskTrigger -AtLogOn

# Réglages : pas de limite de durée, démarre même sur batterie, rattrape si manqué
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit ([TimeSpan]::Zero)

# Enregistre (remplace une éventuelle ancienne version), en contexte utilisateur
Register-ScheduledTask -TaskName $taskName `
    -Action $action -Trigger $trigger -Settings $settings `
    -RunLevel Limited -Force | Out-Null

Write-Host "[OK] Tache '$taskName' installee (demarrage auto a l'ouverture de session)." -ForegroundColor Green

# Démarre tout de suite
Start-ScheduledTask -TaskName $taskName
Write-Host "[OK] Remote Control demarre en arriere-plan." -ForegroundColor Green
Write-Host ""
Write-Host "Vous pouvez fermer cette fenetre : la session continue de tourner." -ForegroundColor Cyan
Write-Host "Retrouvez-la sur https://claude.ai/code (session 'Cryptonauts')." -ForegroundColor Cyan
