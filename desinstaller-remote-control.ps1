# desinstaller-remote-control.ps1
# Retire le demarrage automatique ET arrete la session Remote Control en cours.
# Usage :  powershell -ExecutionPolicy Bypass -File .\desinstaller-remote-control.ps1

$ErrorActionPreference = "SilentlyContinue"

# 1. Supprimer le lanceur du dossier Demarrage
$startupDir = [Environment]::GetFolderPath('Startup')
$vbsPath    = Join-Path $startupDir "claude-remote-control-cryptonauts.vbs"
if (Test-Path $vbsPath) {
    Remove-Item $vbsPath -Force
    Write-Host "[OK] Demarrage automatique supprime." -ForegroundColor Green
} else {
    Write-Host "[i] Aucun lanceur de demarrage trouve." -ForegroundColor DarkGray
}

# 2. Arreter les process en cours -- UNIQUEMENT ceux de CE projet.
$killed = 0

# 2a. PID exacts notes par la boucle (la plus fiable)
$pidFile = Join-Path $PSScriptRoot ".remote-control.pid"
if (Test-Path $pidFile) {
    Get-Content $pidFile | Where-Object { $_ -match '^\d+$' } | ForEach-Object {
        Write-Host ("  arret PID {0} (fichier .pid)" -f $_) -ForegroundColor DarkGray
        Stop-Process -Id ([int]$_) -Force -ErrorAction SilentlyContinue
        $killed++
    }
    Remove-Item $pidFile -Force
}

# 2b. Filet de securite : tout process dont la ligne de commande contient
#     le chemin EXACT de CE dossier (jamais un autre projet).
$projectEsc = [regex]::Escape($PSScriptRoot)
Get-CimInstance Win32_Process | Where-Object {
    $_.CommandLine -and $_.CommandLine -match $projectEsc
} | ForEach-Object {
    Write-Host ("  arret PID {0} (chemin projet)" -f $_.ProcessId) -ForegroundColor DarkGray
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    $killed++
}

Write-Host "[OK] $killed processus de CE projet arrete(s)." -ForegroundColor Green
Write-Host "(Les autres projets, comme 'sport api', ne sont PAS touches.)" -ForegroundColor Cyan
