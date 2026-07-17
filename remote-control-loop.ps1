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

# Session remote-control FRAICHE, autonomie totale, SANS --continue.
# IMPORTANT : --continue reprend une ancienne conversation LOCALE et n'etablit
# PAS la session distante visible sur claude.ai/code. C'est pour ca que les
# projets lances avec --continue ne montraient aucune session. On l'enleve.
$argsFresh = @("--remote-control", $SessionName, "--dangerously-skip-permissions")

# PID de la boucle (le desinstallateur cible aussi par le mot "Cryptonauts")
Set-Content -Path $pidFile -Value $PID -Encoding ASCII

# --- Watchdog : auto-repare un claude FIGE (vivant mais 0 connexion Anthropic) ---
# Cas vecu le 2026-06-24 : au boot, claude peut rester bloque AVANT d'ouvrir la
# connexion remote (onboarding/race reseau). Resultat : invisible sur mobile, et
# la boucle ci-dessous ne le relance PAS car il ne se TERMINE pas (il reste fige).
# Le watchdog le tue apres ~40 s sans connexion etablie vers Anthropic -> la
# boucle le relance alors frais. Tourne dans un job separe, parametre par $SessionName.
$logFile = Join-Path $PSScriptRoot "remote-control-loop.log"
Get-Job -Name "wd-$SessionName" -ErrorAction SilentlyContinue | Remove-Job -Force -ErrorAction SilentlyContinue
Start-Job -Name "wd-$SessionName" -ArgumentList $SessionName, $logFile, $PID -ScriptBlock {
    param($session, $log, $myLoopPid)
    $strikes = 0
    while ($true) {
        Start-Sleep -Seconds 20

        # --- SINGLETON PERMANENT : la loop la plus ANCIENNE gagne -----------
        # Ordre total (StartTime puis PID) => convergence deterministe vers UNE
        # seule loop, sans course d'entre-tuerie. Si JE suis la loop en trop
        # (une autre est plus ancienne), je retire MON claude puis MOI-meme.
        # Corrige le cas "deux loops se disputent le nom -> relais mobile jamais
        # monte -> session invisible" (BETSFIX, 2026-07-17).
        $loops = @(Get-CimInstance Win32_Process -Filter "Name='powershell.exe' OR Name='pwsh.exe'" |
                   Where-Object { $_.CommandLine -match "$session\\remote-control-loop" })
        if ($loops.Count -gt 1) {
            $mine = $loops | Where-Object { $_.ProcessId -eq $myLoopPid } | Select-Object -First 1
            if ($mine) {
                $older = $loops | Where-Object {
                    $_.ProcessId -ne $myLoopPid -and (
                        ($_.CreationDate -lt $mine.CreationDate) -or
                        ($_.CreationDate -eq $mine.CreationDate -and $_.ProcessId -lt $myLoopPid)
                    )
                }
                if ($older) {
                    "$(Get-Date -Format s) SINGLETON: loop $session en double (moi PID $myLoopPid, plus jeune) -> auto-retrait" | Out-File -FilePath $log -Append -Encoding utf8
                    Get-CimInstance Win32_Process -Filter "Name='claude.exe'" |
                        Where-Object { $_.CommandLine -match "remote-control $session" -and $_.ParentProcessId -eq $myLoopPid } |
                        ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
                    Stop-Process -Id $myLoopPid -Force -ErrorAction SilentlyContinue
                    return
                }
            }
        }

        $p = Get-CimInstance Win32_Process -Filter "Name='claude.exe'" |
             Where-Object { $_.CommandLine -match "remote-control $session" } |
             Select-Object -First 1
        if (-not $p) { $strikes = 0; continue }
        $conns = @(Get-NetTCPConnection -OwningProcess $p.ProcessId -State Established -ErrorAction SilentlyContinue |
                   Where-Object { $_.RemoteAddress -notin '127.0.0.1','::1' })
        # Sante = au moins UNE connexion ET pas une "tempete de retry".
        # Tempete = >=15 connexions TOUTES vers une seule IP : le canal API
        # boucle en reconnexion mais le relais mobile (2e IP) n'est jamais monte
        # -> session invisible sur mobile (BETSFIX, 2026-07-17). Une session saine
        # a le relais => >=2 IP distinctes ; une session idle a peu de connexions.
        $distinct = @($conns | Select-Object -ExpandProperty RemoteAddress -Unique).Count
        $storm = ($conns.Count -ge 15 -and $distinct -le 1)
        if ($conns.Count -gt 0 -and -not $storm) { $strikes = 0; continue }
        $strikes++
        if ($strikes -ge 9) {
            $why = if ($storm) { "tempete retry ($($conns.Count) conn / 1 IP, relais absent)" } else { "0 connexion ~180s" }
            "$(Get-Date -Format s) WATCHDOG: claude $session malsain ($why, PID $($p.ProcessId)) -> kill" | Out-File -FilePath $log -Append -Encoding utf8
            Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
            $strikes = 0
        }
    }
} | Out-Null

while ($true) {
    try {
        # On appelle claude DIRECTEMENT (operateur &), pas via Start-Process
        # -WindowStyle Hidden. claude a besoin d'heriter de la console (cachee)
        # de ce PowerShell pour le mode remote-control. Avec
        # Start-Process detache, claude perd sa console et ressort aussitot.
        & $claude @argsFresh
    } catch {
        # crash/timeout reseau : on relance apres une courte pause
    }
    Start-Sleep -Seconds 3
}

