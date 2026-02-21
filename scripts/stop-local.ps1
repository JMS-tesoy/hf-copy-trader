Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir

Write-Host "== Copy Trading Platform: Stop Local ==" -ForegroundColor Cyan

Push-Location $repoRoot
try {
  Write-Host "Stopping Docker services..." -ForegroundColor Yellow
  $dc = Get-Command docker-compose -ErrorAction SilentlyContinue
  if ($dc) {
    docker-compose down | Out-Host
  } else {
    docker compose down | Out-Host
  }
} finally {
  Pop-Location
}

Write-Host "Stopping frontend dev server (next dev)..." -ForegroundColor Yellow
$nextProcesses = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
  $_.Name -eq "node.exe" -and
  $_.CommandLine -and
  $_.CommandLine -match "next[\\/]dist[\\/]bin[\\/]next" -and
  $_.CommandLine -match "dev"
}

if ($nextProcesses) {
  foreach ($p in $nextProcesses) {
    Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
  }
  Write-Host "Stopped $($nextProcesses.Count) frontend dev process(es)." -ForegroundColor Green
} else {
  Write-Host "No frontend dev process found." -ForegroundColor DarkYellow
}

Write-Host "Done." -ForegroundColor Green
