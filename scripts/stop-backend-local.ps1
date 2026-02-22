param()

$ErrorActionPreference = "Continue"

$pidFile = Join-Path $PSScriptRoot ".backend-local-pids.json"
$stopped = 0

function Stop-TrackedPids {
  param([int[]]$Pids)

  foreach ($pid in $Pids) {
    if (-not $pid) { continue }
    $p = Get-Process -Id $pid -ErrorAction SilentlyContinue
    if ($p) {
      Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
      $script:stopped++
    }
  }
}

if (Test-Path $pidFile) {
  try {
    $state = Get-Content $pidFile -Raw | ConvertFrom-Json
    Stop-TrackedPids -Pids @($state.pids)
  } catch {
    Write-Warning "Could not read PID file: $pidFile"
  }
  Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
}

# Fallback for orphaned local backend node processes.
$orphans = @()
try {
  $orphans = Get-CimInstance Win32_Process -ErrorAction Stop |
    Where-Object {
      $_.Name -eq "node.exe" -and
      (
        $_.CommandLine -match "broker-api\.js" -or
        $_.CommandLine -match "worker-server\.js"
      )
    } |
    Select-Object -ExpandProperty ProcessId
} catch {
  Write-Warning "Could not query orphaned node processes; stopping tracked PIDs only."
}

foreach ($pid in $orphans) {
  Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
  $stopped++
}

Write-Host "Stopped $stopped backend process(es)."
