param(
  [string]$ProjectRoot = (Get-Location).Path
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ReportPath = Join-Path $ProjectRoot "10-9_release_check_report.txt"
$Results = New-Object System.Collections.Generic.List[string]
$FailCount = 0
$WarnCount = 0

function Add-Result {
  param(
    [string]$Status,
    [string]$Item,
    [string]$Detail = ""
  )

  $line = "[" + $Status + "] " + $Item
  if ($Detail -ne "") {
    $line = $line + " - " + $Detail
  }

  $script:Results.Add($line)

  if ($Status -eq "FAIL") {
    $script:FailCount = $script:FailCount + 1
  }
  elseif ($Status -eq "WARN") {
    $script:WarnCount = $script:WarnCount + 1
  }
}

function Resolve-ExactFile {
  param(
    [string]$RelativePath,
    [string]$FallbackName = ""
  )

  $exact = Join-Path $ProjectRoot $RelativePath

  if (Test-Path -LiteralPath $exact) {
    return $exact
  }

  if ($FallbackName -eq "") {
    return $null
  }

  $srcRoot = Join-Path $ProjectRoot "src"

  if (-not (Test-Path -LiteralPath $srcRoot)) {
    return $null
  }

  $matches = Get-ChildItem `
    -Path $srcRoot `
    -Recurse `
    -File `
    -Filter $FallbackName `
    -ErrorAction SilentlyContinue

  $first = $matches | Select-Object -First 1

  if ($null -eq $first) {
    return $null
  }

  return $first.FullName
}

function Read-ProjectFile {
  param(
    [string]$FilePath
  )

  if ([string]::IsNullOrWhiteSpace($FilePath)) {
    return ""
  }

  return Get-Content `
    -LiteralPath $FilePath `
    -Raw `
    -Encoding UTF8
}

function Check-Contains {
  param(
    [string]$FilePath,
    [string]$Label,
    [string]$Needle,
    [bool]$Required = $true
  )

  if ([string]::IsNullOrWhiteSpace($FilePath)) {
    if ($Required) {
      Add-Result "FAIL" $Label "file not found"
    }
    else {
      Add-Result "WARN" $Label "file not found"
    }
    return
  }

  $content = Read-ProjectFile $FilePath

  if ($content.Contains($Needle)) {
    Add-Result "PASS" $Label
  }
  else {
    if ($Required) {
      Add-Result "FAIL" $Label ("missing: " + $Needle)
    }
    else {
      Add-Result "WARN" $Label ("missing: " + $Needle)
    }
  }
}

function Check-NotContains {
  param(
    [string]$FilePath,
    [string]$Label,
    [string]$Needle
  )

  if ([string]::IsNullOrWhiteSpace($FilePath)) {
    Add-Result "WARN" $Label "file not found"
    return
  }

  $content = Read-ProjectFile $FilePath

  if (-not $content.Contains($Needle)) {
    Add-Result "PASS" $Label
  }
  else {
    Add-Result "FAIL" $Label ("unexpected pattern: " + $Needle)
  }
}

function Check-Regex {
  param(
    [string]$FilePath,
    [string]$Label,
    [string]$Pattern,
    [bool]$Required = $true
  )

  if ([string]::IsNullOrWhiteSpace($FilePath)) {
    if ($Required) {
      Add-Result "FAIL" $Label "file not found"
    }
    else {
      Add-Result "WARN" $Label "file not found"
    }
    return
  }

  $content = Read-ProjectFile $FilePath

  if ($content -match $Pattern) {
    Add-Result "PASS" $Label
  }
  else {
    if ($Required) {
      Add-Result "FAIL" $Label ("regex missing: " + $Pattern)
    }
    else {
      Add-Result "WARN" $Label ("regex missing: " + $Pattern)
    }
  }
}

function Check-TreeNotContains {
  param(
    [string]$RelativeRoot,
    [string]$Label,
    [string]$Needle
  )

  $targetRoot = Join-Path $ProjectRoot $RelativeRoot

  if (-not (Test-Path -LiteralPath $targetRoot)) {
    Add-Result "WARN" $Label "scan root not found"
    return
  }

  $matches = Get-ChildItem `
    -Path $targetRoot `
    -Recurse `
    -File `
    -Include *.ts,*.tsx `
    -ErrorAction SilentlyContinue |
    Select-String `
      -SimpleMatch `
      -Pattern $Needle `
      -ErrorAction SilentlyContinue

  if ($null -eq $matches) {
    Add-Result "PASS" $Label
    return
  }

  $matchArray = @($matches)

  if ($matchArray.Count -eq 0) {
    Add-Result "PASS" $Label
  }
  else {
    $first = $matchArray | Select-Object -First 1
    Add-Result "FAIL" $Label ("found in " + $first.Path + ":" + $first.LineNumber)
  }
}

function Run-NpmCheck {
  param(
    [string]$Name,
    [string]$ScriptName
  )

  $outputFile = Join-Path $ProjectRoot ("10-9_" + $Name + "_output.txt")
  $commandLine = 'npm.cmd run ' + $ScriptName + ' > "' + $outputFile + '" 2>&1'

  Push-Location $ProjectRoot

  try {
    & cmd.exe /d /s /c $commandLine
    $exitCode = $LASTEXITCODE

    if ($exitCode -eq 0) {
      Add-Result "PASS" ("npm run " + $ScriptName)
    }
    else {
      Add-Result "FAIL" ("npm run " + $ScriptName) ("exit code " + $exitCode)
    }
  }
  catch {
    Add-Result "FAIL" ("npm run " + $ScriptName) $_.Exception.Message
  }
  finally {
    Pop-Location
  }
}

$packageJson = Join-Path $ProjectRoot "package.json"

if (-not (Test-Path -LiteralPath $packageJson)) {
  Write-Host ("package.json not found: " + $ProjectRoot) -ForegroundColor Red
  exit 1
}

Add-Result "PASS" "project root" $ProjectRoot

$closingReadiness = Resolve-ExactFile "src\components\closing\ClosingReadinessPanel.tsx" "ClosingReadinessPanel.tsx"
$dataReset = Resolve-ExactFile "src\components\admin\DataResetPanel.tsx" "DataResetPanel.tsx"
$formulaEngine = Resolve-ExactFile "src\lib\analytics\formula-engine.ts" "formula-engine.ts"
$customAnalysis = Resolve-ExactFile "src\lib\analytics\custom-analysis.ts" "custom-analysis.ts"
$analyticsWorkspace = Resolve-ExactFile "src\components\analytics\AnalyticsWorkspace.tsx" "AnalyticsWorkspace.tsx"
$metricLibrary = Resolve-ExactFile "src\components\analytics\MetricLibraryBuilder.tsx" "MetricLibraryBuilder.tsx"

$requiredFiles = @(
  @("ClosingReadinessPanel", $closingReadiness),
  @("DataResetPanel", $dataReset),
  @("formula-engine", $formulaEngine),
  @("analytics/custom-analysis", $customAnalysis),
  @("AnalyticsWorkspace", $analyticsWorkspace),
  @("MetricLibraryBuilder", $metricLibrary)
)

foreach ($pair in $requiredFiles) {
  if (-not [string]::IsNullOrWhiteSpace([string]$pair[1])) {
    Add-Result "PASS" ($pair[0] + " file") ([string]$pair[1])
  }
  else {
    Add-Result "FAIL" ($pair[0] + " file") "not found"
  }
}

# Closing report checks.
Check-Contains $closingReadiness "closing: attendance RPC" '"get_daily_attendance_readiness"'
Check-Contains $closingReadiness "closing: sales cash table" '"sales_cash_daily"'
Check-Regex $closingReadiness "closing: sales cash confirmed rule" 'cashStatus\s*===\s*"confirmed"'
Check-Regex $closingReadiness "closing: sales cash card" 'ready\s*=\s*\{\s*cashReady'
Check-Contains $closingReadiness "closing: four-card grid" "xl:grid-cols-4"
Check-Contains $closingReadiness "closing: cash included in final readiness" "cashReady"

# Reset checks.
Check-Contains $dataReset "reset: preview RPC" '"admin_preview_operational_data_reset"'
Check-Contains $dataReset "reset: execute RPC" '"admin_execute_operational_data_reset"'
Check-Regex $dataReset "reset: range call p_all false" 'executeRange[\s\S]*?p_all\s*:\s*false'
Check-Regex $dataReset "reset: all call p_all true" 'executeAll[\s\S]*?p_all\s*:\s*true'
Check-Regex $dataReset "reset: range confirmation parameter exists" 'executeRange[\s\S]*?p_confirmation\s*:'
Check-Regex $dataReset "reset: all confirmation parameter exists" 'executeAll[\s\S]*?p_confirmation\s*:'
Check-NotContains $dataReset "reset: range text input removed" "rangeConfirm"
Check-NotContains $dataReset "reset: all text input removed" "allConfirm"

# Analytics checks.
Check-Contains $formulaEngine "analytics: batch evaluator" "evaluatePeriodValues"
Check-Contains $formulaEngine "analytics: dependency depth guard" "ANALYSIS_FORMULA_MAX_DEPENDENCY_DEPTH"
Check-Contains $formulaEngine "analytics: daily WeakMap memo" "WeakMap"

Check-Contains $customAnalysis "analytics: batch formula call" "evaluatePeriodValues"
Check-Contains $customAnalysis "analytics: token index" "formulaTokensByMetricId"
Check-Contains $customAnalysis "analytics: snapshot raw map" "rawMetricValuesByPeriodKey"

# The resultFilter check is intentionally path-independent because the component filename may vary.
Check-TreeNotContains "src\components\analytics" "system compare: resultFilter remains removed" "resultFilter"

# Git is informational at this stage. Final clean commit/tag is done after regression tests.
try {
  Push-Location $ProjectRoot
  $gitStatusLines = & git status --short 2>&1
  $gitExit = $LASTEXITCODE
  Pop-Location

  if ($gitExit -eq 0) {
    $gitStatus = ($gitStatusLines -join [Environment]::NewLine)

    if ([string]::IsNullOrWhiteSpace($gitStatus)) {
      Add-Result "INFO" "git working tree" "clean"
    }
    else {
      Add-Result "INFO" "git working tree" "changes exist; final commit/tag is pending"
      $Results.Add("")
      $Results.Add("[GIT STATUS]")
      $Results.Add($gitStatus)
    }
  }
  else {
    Add-Result "INFO" "git status" "git returned non-zero"
  }
}
catch {
  try {
    Pop-Location
  }
  catch {
  }

  Add-Result "INFO" "git status" "git not available or not a repository"
}

# Core file hashes.
$hashFiles = @(
  $closingReadiness,
  $dataReset,
  $formulaEngine,
  $customAnalysis,
  $analyticsWorkspace,
  $metricLibrary
) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }

$Results.Add("")
$Results.Add("[CORE FILE SHA256]")

foreach ($file in $hashFiles) {
  $hash = Get-FileHash -LiteralPath $file -Algorithm SHA256

  if ($file.Length -ge $ProjectRoot.Length) {
    $relative = $file.Substring($ProjectRoot.Length).TrimStart([char]92)
  }
  else {
    $relative = $file
  }

  $Results.Add($relative + " = " + $hash.Hash)
}

# Full project lint/build. Use npm.cmd through cmd.exe to avoid PowerShell npm.ps1 compatibility issues.
Run-NpmCheck "lint" "lint"
Run-NpmCheck "build" "build"

$header = @(
  "WONSUNG DAILY CLOSING - 10-9 RELEASE CHECK V4",
  ("Run time: " + (Get-Date -Format "yyyy-MM-dd HH:mm:ss")),
  ("Project: " + $ProjectRoot),
  ""
)

$summary = @(
  "",
  "============================================================",
  ("FAIL: " + $FailCount),
  ("WARN: " + $WarnCount),
  ""
)

if ($FailCount -eq 0) {
  $summary += "AUTOMATED RESULT: PASS"
}
else {
  $summary += "AUTOMATED RESULT: FAIL"
}

$allLines = @()
$allLines += $header
$allLines += $Results
$allLines += $summary

$allLines |
  Set-Content `
    -LiteralPath $ReportPath `
    -Encoding UTF8

Write-Host ""
Write-Host "============================================================"
Write-Host "10-9 release check V4 finished"
Write-Host ("FAIL: " + $FailCount)
Write-Host ("WARN: " + $WarnCount)
Write-Host ("Report: " + $ReportPath)
Write-Host "============================================================"

if ($FailCount -gt 0) {
  exit 1
}

exit 0
