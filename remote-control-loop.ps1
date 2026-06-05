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

# Style uniformise avec les autres projets (NEXBET, API-SPORT) :
#   session interactive remote-control + autonomie totale.
# On tente d'abord AVEC --continue (reprend la derniere conversation, comme
# NEXBET). Si claude ressort tout de suite (aucune conversation a reprendre
# dans ce dossier), on relance SANS --continue pour creer une session fraiche.
$argsContinue = @("--remote-control", $SessionName, "--continue", "--dangerously-skip-permissions")
$argsFresh    = @("--remote-control", $SessionName, "--dangerously-skip-permissions")
$attempts     = @($argsContinue, $argsFresh)

while ($true) {
    foreach ($argSet in $attempts) {
        $start = Get-Date
        try {
            $proc = Start-Process -FilePath $claude -ArgumentList $argSet `
                -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -PassThru
            # Noter le PID de la session (la boucle + la session)
            Set-Content -Path $pidFile -Value @($PID, $proc.Id) -Encoding ASCII
            Wait-Process -Id $proc.Id
        } catch {
            # on ignore et on passe a la tentative suivante
        }
        # Si la session a tenu >= 20s, c'est qu'elle fonctionnait : on ne passe
        # pas a la variante "fresh", on attend juste avant un nouveau cycle.
        if (((Get-Date) - $start).TotalSeconds -ge 20) { break }
        # Sinon : sortie quasi immediate -> on essaie la variante suivante.
    }
    Start-Sleep -Seconds 10
}
