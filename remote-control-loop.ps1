# remote-control-loop.ps1
# Maintient Claude Remote Control actif en permanence POUR CE PROJET.
# Lance par le dossier Demarrage (voir installer-remote-control.ps1).
# Si la session s'arrete (timeout reseau, veille, crash...), elle est relancee.
#
# Le PID de la session en cours est ecrit dans .remote-control.pid pour que
# le desinstallateur puisse arreter UNIQUEMENT ce projet.

$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot

# --- Nom de session : UNIQUE a ce projet (evite la confusion avec d'autres) ---
$SessionName = "CRYPTONAUTS"

# --- Localiser claude.exe ---
$claude = (Get-Command claude -ErrorAction SilentlyContinue).Source
if (-not $claude) {
    $candidate = Join-Path $env:LOCALAPPDATA "Programs\Claude\claude.exe"
    if (Test-Path $candidate) { $claude = $candidate }
}
if (-not $claude) { $claude = "claude" }

$pidFile = Join-Path $PSScriptRoot ".remote-control.pid"

# Style IDENTIQUE au lanceur PRONOSTICS/NEXBET qui fonctionne :
#   session remote-control FRAICHE, autonomie totale, SANS --continue.
# IMPORTANT : --continue reprend une ancienne conversation LOCALE et n'etablit
# PAS la session distante visible sur claude.ai/code. C'est pour ca que les
# projets lances avec --continue ne montraient aucune session. On l'enleve.
$argsFresh = @("--remote-control", $SessionName, "--dangerously-skip-permissions")

# PID de la boucle (le desinstallateur cible aussi par le mot "Cryptonauts")
Set-Content -Path $pidFile -Value $PID -Encoding ASCII

while ($true) {
    try {
        # On appelle claude DIRECTEMENT (operateur &), pas via Start-Process
        # -WindowStyle Hidden. claude a besoin d'heriter de la console (cachee)
        # de ce PowerShell pour le mode remote-control -- comme NEXBET. Avec
        # Start-Process detache, claude perd sa console et ressort aussitot.
        & $claude @argsFresh
    } catch {
        # crash/timeout reseau : on relance apres une courte pause
    }
    Start-Sleep -Seconds 10
}

