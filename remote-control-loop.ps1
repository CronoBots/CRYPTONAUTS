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
$SessionName = "Cryptonauts"

# --- Localiser claude.exe ---
$claude = (Get-Command claude -ErrorAction SilentlyContinue).Source
if (-not $claude) {
    $candidate = Join-Path $env:LOCALAPPDATA "Programs\Claude\claude.exe"
    if (Test-Path $candidate) { $claude = $candidate }
}
if (-not $claude) { $claude = "claude" }

$pidFile = Join-Path $PSScriptRoot ".remote-control.pid"

while ($true) {
    try {
        # Style uniformise avec les autres projets (NEXBET, API-SPORT) :
        #   session interactive + reprise (--continue) + autonomie totale
        #   (--dangerously-skip-permissions)
        $proc = Start-Process -FilePath $claude `
            -ArgumentList @("--remote-control", $SessionName, "--continue", "--dangerously-skip-permissions") `
            -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -PassThru
        # Noter le PID de la session (la boucle + la session)
        Set-Content -Path $pidFile -Value @($PID, $proc.Id) -Encoding ASCII
        Wait-Process -Id $proc.Id
    } catch {
        # on ignore et on relance
    }
    Start-Sleep -Seconds 10
}
