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
#    Identifiant : le mot "Cryptonauts" dans la ligne de commande.
#    C'est le nom de session ET le nom du dossier de CE projet, et il est
#    UNIQUE : ni NEXBET ni API-SPORT ne contiennent "Cryptonauts".
#    -> on attrape la boucle PowerShell, le lanceur .vbs ET le process
#       claude.exe enfant (--name Cryptonauts / --remote-control Cryptonauts),
#       quel que soit le style (ancien ou nouveau).
$killed = 0
$marker = "cryptonauts"

# (on retire d'abord le fichier .pid, devenu inutile)
$pidFile = Join-Path $PSScriptRoot ".remote-control.pid"
if (Test-Path $pidFile) { Remove-Item $pidFile -Force }

Get-CimInstance Win32_Process | Where-Object {
    $_.ProcessId -ne $PID -and                       # pas le desinstallateur lui-meme
    $_.CommandLine -and
    $_.CommandLine.ToLower().Contains($marker)
} | ForEach-Object {
    Write-Host ("  arret PID {0} : {1}" -f $_.ProcessId, $_.CommandLine) -ForegroundColor DarkGray
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    $killed++
}

Write-Host "[OK] $killed processus 'Cryptonauts' arrete(s)." -ForegroundColor Green
Write-Host "(NEXBET et API-SPORT ne sont PAS touches.)" -ForegroundColor Cyan
