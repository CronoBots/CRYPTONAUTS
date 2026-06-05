# remote-control-loop.ps1
# Maintient Claude Remote Control actif en permanence.
# Lancé en arrière-plan par la tâche planifiée (voir installer-remote-control.ps1).
# Si le process s'arrête (timeout réseau, mise en veille, crash...), il est relancé.

$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot

# Localiser claude.exe
$claude = (Get-Command claude -ErrorAction SilentlyContinue).Source
if (-not $claude) {
    $candidate = Join-Path $env:LOCALAPPDATA "Programs\Claude\claude.exe"
    if (Test-Path $candidate) { $claude = $candidate }
}
if (-not $claude) {
    # Dernier recours : on suppose qu'il est dans le PATH
    $claude = "claude"
}

while ($true) {
    try {
        & $claude remote-control --name "Cryptonauts"
    } catch {
        # on ignore et on relance
    }
    # Le process s'est arrêté : petite pause puis relance
    Start-Sleep -Seconds 10
}
