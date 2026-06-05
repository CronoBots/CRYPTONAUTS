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

# 2. Arreter les process en cours (boucle + remote-control)
$killed = 0
Get-CimInstance Win32_Process | Where-Object {
    $_.CommandLine -and (
        $_.CommandLine -match "remote-control-loop\.ps1" -or
        $_.CommandLine -match "remote-control --name .{0,3}Cryptonauts"
    )
} | ForEach-Object {
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    $killed++
}
Write-Host "[OK] $killed processus arrete(s)." -ForegroundColor Green
Write-Host "Remote Control est desactive." -ForegroundColor Cyan
