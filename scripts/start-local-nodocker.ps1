param()

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$frontendPath = Join-Path $repoRoot "frontend"
$backendStartScript = Join-Path $PSScriptRoot "start-backend-local.ps1"

if (-not (Test-Path $backendStartScript)) {
  throw "Missing script: $backendStartScript"
}

if (-not (Test-Path (Join-Path $frontendPath "package.json"))) {
  throw "frontend folder not found at: $frontendPath"
}

Write-Host "Starting local backend (non-Docker)..."
powershell -NoProfile -ExecutionPolicy Bypass -File $backendStartScript

Write-Host ""
Write-Host "Starting frontend dev server..."
$frontendCmd = "Set-Location -LiteralPath '$frontendPath'; npm run dev"
Start-Process -FilePath "powershell.exe" -ArgumentList @("-NoExit", "-Command", $frontendCmd) | Out-Null

Write-Host ""
Write-Host "Started local no-Docker stack:"
Write-Host "  Frontend: http://localhost:3000"
Write-Host "  Backend:  http://127.0.0.1:4000"
Write-Host ""
Write-Host "Stop backend with: powershell -ExecutionPolicy Bypass -File scripts\stop-backend-local.ps1"
Write-Host "Stop frontend by closing its terminal or stopping next dev process."

