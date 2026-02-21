Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir
$backendDir = Join-Path $repoRoot "backend"
$frontendDir = Join-Path $repoRoot "frontend"

function Test-PortOpen {
  param(
    [Parameter(Mandatory = $true)][int]$Port
  )
  try {
    $tcp = New-Object System.Net.Sockets.TcpClient
    $iar = $tcp.BeginConnect("127.0.0.1", $Port, $null, $null)
    $ok = $iar.AsyncWaitHandle.WaitOne(350)
    if ($ok -and $tcp.Connected) {
      $tcp.EndConnect($iar) | Out-Null
      $tcp.Close()
      return $true
    }
    $tcp.Close()
    return $false
  } catch {
    return $false
  }
}

function Test-DockerReady {
  $dockerCmd = Get-Command docker -ErrorAction SilentlyContinue
  if (-not $dockerCmd) { return $false }
  try {
    docker info | Out-Null
    return $LASTEXITCODE -eq 0
  } catch {
    return $false
  }
}

function Ensure-DockerReady {
  if (Test-DockerReady) { return }

  Write-Warning "Docker engine is not ready. Trying to open Docker Desktop..."
  $candidates = @(
    (Join-Path $env:ProgramFiles "Docker\Docker\Docker Desktop.exe"),
    (Join-Path $env:LocalAppData "Programs\Docker\Docker\Docker Desktop.exe")
  )

  $launched = $false
  foreach ($exe in $candidates) {
    if (Test-Path $exe) {
      Start-Process -FilePath $exe | Out-Null
      $launched = $true
      break
    }
  }

  if (-not $launched) {
    Write-Error "Docker Desktop executable not found. Start Docker Desktop manually, then re-run this script."
    exit 1
  }

  Write-Host "Waiting for Docker engine to become ready..." -ForegroundColor Yellow
  $maxWaitSeconds = 120
  $elapsed = 0
  while ($elapsed -lt $maxWaitSeconds) {
    Start-Sleep -Seconds 3
    $elapsed += 3
    if (Test-DockerReady) {
      Write-Host "Docker is ready." -ForegroundColor Green
      return
    }
  }

  Write-Error "Docker did not become ready within $maxWaitSeconds seconds. Check Docker Desktop status and retry."
  exit 1
}

Write-Host "== Copy Trading Platform: Local Launcher ==" -ForegroundColor Cyan
Write-Host "Repo root: $repoRoot"

if (!(Test-Path (Join-Path $backendDir "node_modules"))) {
  Write-Warning "backend/node_modules is missing. Run: cd backend; npm install"
}
if (!(Test-Path (Join-Path $frontendDir "node_modules"))) {
  Write-Warning "frontend/node_modules is missing. Run: cd frontend; npm install"
}

if (Test-PortOpen -Port 4000) {
  Write-Warning "Port 4000 is already in use. If PM2 backend is running, stop it to avoid Docker conflicts."
}

Ensure-DockerReady

Write-Host "Starting Docker services (docker-compose up -d --build)..." -ForegroundColor Yellow
Push-Location $repoRoot
try {
  $dc = Get-Command docker-compose -ErrorAction SilentlyContinue
  if ($dc) {
    docker-compose up -d --build | Out-Host
    docker-compose ps | Out-Host
  } else {
    docker compose up -d --build | Out-Host
    docker compose ps | Out-Host
  }
} finally {
  Pop-Location
}

if (!(Test-PortOpen -Port 4000)) {
  Write-Warning "Backend API port 4000 is not reachable yet. Check docker logs if needed."
}

Write-Host "Starting frontend dev server in a new window..." -ForegroundColor Yellow
$frontendCmd = "Set-Location -LiteralPath '$frontendDir'; npm run dev"
Start-Process powershell -ArgumentList @("-NoExit", "-Command", $frontendCmd) | Out-Null

Write-Host ""
Write-Host "Done." -ForegroundColor Green
Write-Host "Frontend: http://localhost:3000"
Write-Host "Backend API: http://127.0.0.1:4000"
Write-Host "Nginx: http://127.0.0.1"
Write-Host ""
Write-Host "One-click stop: .\\scripts\\stop-local.bat"
