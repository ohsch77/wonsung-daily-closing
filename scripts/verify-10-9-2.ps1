param(
  [string]$ProjectRoot = (Get-Location).Path
)

$ErrorActionPreference = "Stop"

function Pass($m) { Write-Host "[PASS] $m" -ForegroundColor Green }
function Fail($m) { Write-Host "[FAIL] $m" -ForegroundColor Red; exit 1 }

$system = Join-Path $ProjectRoot "src\components\system-performance\SystemPerformanceOverview.tsx"
$cardParser = Join-Path $ProjectRoot "src\lib\card-performance-parser.ts"
$cardOverview = Join-Path $ProjectRoot "src\components\card\CardPerformanceOverview.tsx"
$report = Join-Path $ProjectRoot "src\components\closing\ClosingReportCard.tsx"

foreach ($p in @($system, $cardParser, $cardOverview, $report)) {
  if (-not (Test-Path -LiteralPath $p)) { Fail "missing file: $p" }
}

$s = Get-Content -LiteralPath $system -Raw -Encoding UTF8
if ($s -notmatch '당일누적') { Fail "system current snapshot label" }
if ($s -notmatch '두 누적값의 차이로 당일실적') { Fail "system difference description" }
Pass "system previous/current cumulative semantics"

$c = Get-Content -LiteralPath $cardParser -Raw -Encoding UTF8
if ($c -notmatch 'targetDate < periodStartDate') { Fail "card month start filter" }
if ($c -notmatch 'targetDate > reportDate') { Fail "card report date upper bound" }
if ($c -notmatch 'datasetType === "approval"[\s\S]*?\? approvalDate[\s\S]*?: cancelDate') { Fail "card approval/cancel date basis" }
Pass "card full cumulative source + date basis"

$o = Get-Content -LiteralPath $cardOverview -Raw -Encoding UTF8
if ($o -notmatch '승인일자 기준으로 당일·누적') { Fail "card approval UI description" }
if ($o -notmatch '취소일자 기준으로 당일·누적') { Fail "card cancel UI description" }
Pass "card UI semantics"

$r = Get-Content -LiteralPath $report -Raw -Encoding UTF8
if ($r -notmatch '/\s*1_000_000') { Fail "report KK divisor" }
if (($r -notmatch 'minimumFractionDigits\s*:\s*1') -and ($r -notmatch '\.toFixed\(\s*1\s*\)')) {
  Fail "report one decimal display"
}
Pass "report KK ###0.0,, display"

Write-Host ""
Write-Host "Running lint..." -ForegroundColor Cyan
& npm.cmd run lint
if ($LASTEXITCODE -ne 0) { Fail "npm run lint" }
Pass "npm run lint"

Write-Host ""
Write-Host "Running build..." -ForegroundColor Cyan
& npm.cmd run build
if ($LASTEXITCODE -ne 0) { Fail "npm run build" }
Pass "npm run build"

Write-Host ""
Write-Host "10-9-2 verification complete: PASS" -ForegroundColor Green
