param(
  [Parameter(Mandatory = $true)]
  [string]$Email
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-PostgresContainerId {
  $id = docker ps -q `
    --filter "label=com.docker.compose.project=copy-trading-platform" `
    --filter "label=com.docker.compose.service=postgres" | Select-Object -First 1

  if (-not $id) {
    $id = docker ps -q --filter "name=copy-trading-platform-postgres" | Select-Object -First 1
  }

  return $id
}

$containerId = Get-PostgresContainerId
if (-not $containerId) {
  Write-Error "Postgres Docker container not found. Start stack first: docker-compose up -d --build"
  exit 1
}

$safeEmail = $Email.Replace("'", "''").ToLowerInvariant()
$sql = "select id, name, email, created_at from users where lower(email)=lower('$safeEmail');"

Write-Host "Querying Docker Postgres for: $Email" -ForegroundColor Cyan
docker exec $containerId psql -U postgres -d copy_trading -c $sql
