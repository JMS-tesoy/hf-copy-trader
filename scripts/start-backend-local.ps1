param(
  [string]$BackendDir = (Join-Path $PSScriptRoot "..\backend")
)

$ErrorActionPreference = "Stop"

$backendPath = (Resolve-Path $BackendDir).Path
$pidFile = Join-Path $PSScriptRoot ".backend-local-pids.json"

function Start-NodeWindow {
  param(
    [string]$Title,
    [string]$Command
  )

  $args = @(
    "-NoExit",
    "-Command",
    "$host.UI.RawUI.WindowTitle = '$Title'; Set-Location -LiteralPath '$backendPath'; $Command"
  )

  $proc = Start-Process -FilePath "powershell.exe" -ArgumentList $args -PassThru
  return $proc
}

if (-not (Test-Path (Join-Path $backendPath "package.json"))) {
  throw "backend folder not found at: $backendPath"
}

if (-not (Test-Path (Join-Path $backendPath "node_modules"))) {
  Write-Warning "backend/node_modules is missing. Run: cd backend; npm install"
}

Write-Host "Starting local backend processes from: $backendPath"

$api = Start-NodeWindow -Title "backend-api:4000" -Command "node broker-api.js"
$w0  = Start-NodeWindow -Title "backend-worker-0:8081" -Command "`$env:SHARD_ID='0'; `$env:PORT='8081'; `$env:TOTAL_SHARDS='3'; node worker-server.js"
$w1  = Start-NodeWindow -Title "backend-worker-1:8082" -Command "`$env:SHARD_ID='1'; `$env:PORT='8082'; `$env:TOTAL_SHARDS='3'; node worker-server.js"
$w2  = Start-NodeWindow -Title "backend-worker-2:8083" -Command "`$env:SHARD_ID='2'; `$env:PORT='8083'; `$env:TOTAL_SHARDS='3'; node worker-server.js"

$state = [ordered]@{
  started_at = (Get-Date).ToString("o")
  backend_dir = $backendPath
  pids = @($api.Id, $w0.Id, $w1.Id, $w2.Id)
}

$state | ConvertTo-Json | Set-Content -Encoding UTF8 $pidFile

Write-Host ""
Write-Host "Started:"
Write-Host "  API      PID $($api.Id)  -> http://127.0.0.1:4000"
Write-Host "  Worker0  PID $($w0.Id)   -> ws://127.0.0.1:8081"
Write-Host "  Worker1  PID $($w1.Id)   -> ws://127.0.0.1:8082"
Write-Host "  Worker2  PID $($w2.Id)   -> ws://127.0.0.1:8083"
Write-Host ""
Write-Host "PID state file: $pidFile"
Write-Host "Stop with: powershell -ExecutionPolicy Bypass -File scripts\stop-backend-local.ps1"
