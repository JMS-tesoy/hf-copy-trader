param(
  [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir
$backendEnvPath = Join-Path $repoRoot "backend\.env"
$rootEnvPath = Join-Path $repoRoot ".env"

function Load-EnvFile {
  param([Parameter(Mandatory = $true)][string]$Path)
  $map = @{}
  foreach ($line in Get-Content $Path) {
    if ([string]::IsNullOrWhiteSpace($line)) { continue }
    if ($line.TrimStart().StartsWith("#")) { continue }
    $eq = $line.IndexOf("=")
    if ($eq -lt 1) { continue }
    $key = $line.Substring(0, $eq).Trim()
    $val = $line.Substring($eq + 1).Trim()
    if ($val.StartsWith('"') -and $val.EndsWith('"') -and $val.Length -ge 2) {
      $val = $val.Substring(1, $val.Length - 2)
    }
    $map[$key] = $val
  }
  return $map
}

function Get-PostgresContainerId {
  $id = docker ps -q `
    --filter "label=com.docker.compose.project=copy-trading-platform" `
    --filter "label=com.docker.compose.service=postgres" | Select-Object -First 1
  if (-not $id) {
    $id = docker ps -q --filter "name=copy-trading-platform-postgres" | Select-Object -First 1
  }
  return $id
}

function Require-Command {
  param([Parameter(Mandatory = $true)][string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command not found: $Name"
  }
}

Write-Host "== Sync Local DB From Docker DB ==" -ForegroundColor Cyan

$envPath = if (Test-Path $backendEnvPath) { $backendEnvPath } elseif (Test-Path $rootEnvPath) { $rootEnvPath } else { $null }
if (-not $envPath) {
  throw "No .env file found (expected backend/.env or .env)."
}

$cfg = Load-EnvFile -Path $envPath
$pgHost = if ($cfg.ContainsKey("PG_HOST")) { $cfg["PG_HOST"] } else { "127.0.0.1" }
$pgPort = if ($cfg.ContainsKey("PG_PORT")) { $cfg["PG_PORT"] } else { "5432" }
$pgDb = if ($cfg.ContainsKey("PG_DATABASE")) { $cfg["PG_DATABASE"] } else { "copy_trading" }
$pgUser = if ($cfg.ContainsKey("PG_USER")) { $cfg["PG_USER"] } else { "postgres" }
$pgPassword = if ($cfg.ContainsKey("PG_PASSWORD")) { $cfg["PG_PASSWORD"] } else { "" }

Require-Command -Name docker
Require-Command -Name psql

$containerId = Get-PostgresContainerId
if (-not $containerId) {
  throw "Docker Postgres container not found. Start stack first: docker-compose up -d --build"
}

$env:PGPASSWORD = $pgPassword

$exists = psql -h $pgHost -p $pgPort -U $pgUser -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$pgDb';"
if ($LASTEXITCODE -ne 0) {
  throw "Cannot reach local Postgres at $pgHost`:$pgPort as user $pgUser."
}

if (-not "$exists".Trim().Equals("1")) {
  Write-Host "Local DB '$pgDb' does not exist. Creating..." -ForegroundColor Yellow
  createdb -h $pgHost -p $pgPort -U $pgUser $pgDb
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to create local database '$pgDb'."
  }
}

if (-not $Force) {
  Write-Warning "This will OVERWRITE local database '$pgDb' with data from Docker Postgres container '$containerId'."
  $confirm = Read-Host "Type SYNC to continue"
  if ($confirm -ne "SYNC") {
    Write-Host "Cancelled." -ForegroundColor Yellow
    exit 0
  }
}

$tempFile = Join-Path $env:TEMP ("copy_trading_sync_{0:yyyyMMdd_HHmmss}.sql" -f (Get-Date))
Write-Host "Exporting from Docker DB to $tempFile ..." -ForegroundColor Yellow
$dumpCmd = "docker exec $containerId pg_dump -U postgres -d $pgDb --clean --if-exists --no-owner --no-privileges > `"$tempFile`""
cmd /c $dumpCmd | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw "Failed to dump Docker Postgres database."
}

# Cross-version compatibility: PG16+ dumps include transaction_timeout,
# which older local servers may not recognize.
$filtered = Get-Content $tempFile | Where-Object { $_ -notmatch '^SET transaction_timeout = ' }
Set-Content -Path $tempFile -Value $filtered -Encoding UTF8

Write-Host "Importing into local DB '$pgDb' ..." -ForegroundColor Yellow
psql -v ON_ERROR_STOP=1 -h $pgHost -p $pgPort -U $pgUser -d $pgDb -f $tempFile | Out-Host
if ($LASTEXITCODE -ne 0) {
  throw "Failed to restore dump into local database."
}

Remove-Item $tempFile -ErrorAction SilentlyContinue
Write-Host "Sync complete. Local DB is now aligned with Docker DB." -ForegroundColor Green
