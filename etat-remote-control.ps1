# etat-remote-control.ps1
# Inventaire de TOUS les projets Claude Remote Control de ce PC.
# À lancer avant/après installation pour comparer et ne pas s'emmêler.
# Usage :  powershell -ExecutionPolicy Bypass -File .\etat-remote-control.ps1

$ErrorActionPreference = "SilentlyContinue"

Write-Host ""
Write-Host "==== 1. Lanceurs dans le dossier Demarrage ====" -ForegroundColor Cyan
$startupDir = [Environment]::GetFolderPath('Startup')
Write-Host "($startupDir)" -ForegroundColor DarkGray
$items = Get-ChildItem $startupDir -File | Where-Object {
    $_.Extension -in ".vbs",".bat",".cmd",".lnk",".ps1"
}
if ($items) { $items | Select-Object Name, LastWriteTime | Format-Table -AutoSize }
else { Write-Host "  (aucun)" -ForegroundColor DarkGray }

Write-Host "==== 2. Taches planifiees liees a Claude/Remote ====" -ForegroundColor Cyan
$tasks = Get-ScheduledTask | Where-Object { $_.TaskName -match "claude|remote|control" }
if ($tasks) { $tasks | Select-Object TaskName, State | Format-Table -AutoSize }
else { Write-Host "  (aucune)" -ForegroundColor DarkGray }

Write-Host "==== 3. Sessions Remote Control EN COURS (tous projets) ====" -ForegroundColor Cyan
$procs = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match "remote-control" }
if ($procs) {
    foreach ($p in $procs) {
        # Tenter d'extraire le nom de session (--name "...") et le dossier
        $name = if ($p.CommandLine -match '--name\s+"?([^"]+?)"?(\s|$)') { $Matches[1] } else { "(sans nom)" }
        Write-Host ("  PID {0,-6} | session: {1}" -f $p.ProcessId, $name) -ForegroundColor Yellow
        Write-Host ("           cmd: {0}" -f $p.CommandLine) -ForegroundColor DarkGray
    }
} else {
    Write-Host "  (aucune session active)" -ForegroundColor DarkGray
}
Write-Host ""
Write-Host "Comparez les noms de session : chaque projet doit avoir un nom UNIQUE." -ForegroundColor Cyan
