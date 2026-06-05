# installer-remote-control.ps1
# À LANCER UNE SEULE FOIS sur votre PC, dans le dossier du dépôt.
#
# Installe Claude Remote Control en TÂCHE PLANIFIÉE Windows -- exactement comme
# le projet PRONOSTICS/NEXBET (tâche "NEXBET Remote Control") :
#   - démarre automatiquement à chaque OUVERTURE DE SESSION Windows,
#   - tourne en arrière-plan SANS fenêtre (PowerShell caché),
#   - se relance tout seul s'il s'arrête (boucle remote-control-loop.ps1 +
#     RestartOnFailure de la tâche).
#
# La création d'une tâche planifiée demande une élévation : une fenêtre UAC
# apparaîtra (cliquez « Oui »). Le script se ré-élève tout seul si besoin.
#
# Usage :  powershell -ExecutionPolicy Bypass -File .\installer-remote-control.ps1
#
# Pour DÉSINSTALLER : .\desinstaller-remote-control.ps1

$ErrorActionPreference = "Stop"

$projectDir = $PSScriptRoot
$loopScript = Join-Path $projectDir "remote-control-loop.ps1"
$taskName   = "CRYPTONAUTS Remote Control"

if (-not (Test-Path $loopScript)) {
    Write-Error "remote-control-loop.ps1 introuvable dans $projectDir. Faites d'abord 'git pull origin main'."
    exit 1
}

# --- Se ré-élever si on n'est pas administrateur (création de tâche = admin) ---
$isAdmin = ([Security.Principal.WindowsPrincipal] `
    [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltinRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "[i] Elevation requise pour creer la tache planifiee (UAC)..." -ForegroundColor Yellow
    Start-Process powershell.exe -Verb RunAs -Wait -ArgumentList `
        '-NoProfile','-ExecutionPolicy','Bypass','-File',"`"$PSCommandPath`""
    exit
}

# --- À partir d'ici on est élevé ---

# Nettoyer un éventuel ancien lanceur .vbs (méthode dossier Démarrage obsolète)
$startupDir = [Environment]::GetFolderPath('Startup')
$oldVbs = Join-Path $startupDir "claude-remote-control-cryptonauts.vbs"
if (Test-Path $oldVbs) {
    Remove-Item $oldVbs -Force
    Write-Host "[OK] Ancien lanceur .vbs supprime (remplace par la tache planifiee)." -ForegroundColor Green
}

# Tâche identique à "NEXBET Remote Control" : déclencheur ouverture de session,
# PowerShell caché lançant la boucle, relance auto en cas d'échec.
$sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$xml = @"
<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.3" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <URI>\$taskName</URI>
  </RegistrationInfo>
  <Principals>
    <Principal id="Author">
      <UserId>$sid</UserId>
      <LogonType>InteractiveToken</LogonType>
    </Principal>
  </Principals>
  <Settings>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <RestartOnFailure>
      <Count>999</Count>
      <Interval>PT1M</Interval>
    </RestartOnFailure>
    <UseUnifiedSchedulingEngine>true</UseUnifiedSchedulingEngine>
  </Settings>
  <Triggers>
    <LogonTrigger />
  </Triggers>
  <Actions Context="Author">
    <Exec>
      <Command>powershell.exe</Command>
      <Arguments>-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "$loopScript"</Arguments>
    </Exec>
  </Actions>
</Task>
"@

Register-ScheduledTask -TaskName $taskName -Xml $xml -Force | Out-Null
Write-Host "[OK] Tache planifiee creee : $taskName" -ForegroundColor Green

# Démarre tout de suite (sans attendre le prochain redémarrage / login)
Start-ScheduledTask -TaskName $taskName
Write-Host "[OK] Remote Control demarre en arriere-plan." -ForegroundColor Green
Write-Host ""
Write-Host "Retrouvez la session 'CRYPTONAUTS' sur https://claude.ai/code." -ForegroundColor Cyan
Write-Host "Pour desinstaller : .\desinstaller-remote-control.ps1" -ForegroundColor DarkGray
