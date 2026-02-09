param(
  [string]$DatasetPath = "D:\MAN\dataset\dataset_3\dataset.csv",
  [int]$Limit = 0,
  [int]$Offset = 0,
  [int]$Chunk = 5000,
  [switch]$Fresh
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

Write-Host "Repo: $repoRoot"
Write-Host "Dataset: $DatasetPath"
Write-Host "Limit: $Limit (0 = no limit)"
Write-Host "Offset: $Offset"
Write-Host "Chunk: $Chunk"

if (-not (Test-Path $DatasetPath)) {
  throw "Dataset not found: $DatasetPath"
}

if ($Limit -lt 0) { throw "Limit must be >= 0" }
if ($Offset -lt 0) { throw "Offset must be >= 0" }
if ($Chunk -lt 1) { throw "Chunk must be >= 1" }

if ($Fresh) {
  $db = Join-Path $repoRoot "db.sqlite3"
  if (Test-Path $db) {
    $stamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $bak = Join-Path $repoRoot ("db.sqlite3.bak_" + $stamp)
    Copy-Item $db $bak -Force
    Remove-Item $db -Force
    Write-Host "Backed up DB to: $bak"
    Write-Host "Removed old DB: $db"
  }
}

Write-Host "Running migrations..."
python manage.py migrate --noinput

Write-Host "Importing dataset..."
python manage.py import_dataset --path "$DatasetPath" --limit $Limit --offset $Offset --chunk $Chunk

Write-Host "Done. Current counts:"
python manage.py shell -c "from solar.models import SmallBody; print('total',SmallBody.objects.count())"
