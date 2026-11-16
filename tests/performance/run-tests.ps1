param(
    [int[]]$Users = @(10, 25, 50),
    [string]$K6Path = '',
    [string]$BaseUrl = 'http://127.0.0.1:8086',
    [switch]$Cloud
)
$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path.Replace('\', '/')
if (!$K6Path) { $K6Path = "$projectRoot/.tools/k6/bin/k6-v2.4.0-windows-amd64/k6.exe" }
if (!(Test-Path -LiteralPath $K6Path)) { throw 'Install k6 or provide -K6Path.' }
$env:K6_USERS_FILE = "$projectRoot/.tools/k6/credentials.json"
if (!(Test-Path -LiteralPath $env:K6_USERS_FILE)) { throw 'Start the isolated test server first.' }
$env:BASE_URL = $BaseUrl
$env:K6_WEB_DASHBOARD = 'true'
$env:K6_WEB_DASHBOARD_PORT = '-1'
$env:K6_WEB_DASHBOARD_PERIOD = '5s'
$outcomes = @()
foreach ($count in $Users) {
    if ($count -lt 1 -or $count -gt 50) { throw 'The disposable fixture supports 1 through 50 distinct users.' }
    $env:TEST_VUS = "$count"
    $mode = if ($Cloud) { 'cloud' } else { 'local' }
    $env:RESULT_PREFIX = "$projectRoot/.tools/k6/results/$mode-lms-$count"
    $env:K6_WEB_DASHBOARD_EXPORT = "$env:RESULT_PREFIX.html"
    $arguments = @('run', '--no-usage-report', '--out', "json=$env:RESULT_PREFIX.metrics.json.gz", "$PSScriptRoot/lms.k6.js")
    if ($Cloud) {
        $arguments = @('cloud', 'run', '--local-execution', '--no-archive-upload', '--no-cloud-logs', '--no-cloud-secrets', '--no-usage-report', '--include-system-env-vars', "$PSScriptRoot/lms.k6.js")
    }
    Write-Output "Starting $count concurrent users ($mode)."
    & $K6Path @arguments
    $outcomes += @{ users = $count; mode = $mode; exit_code = $LASTEXITCODE; result_prefix = $env:RESULT_PREFIX }
    if ($LASTEXITCODE -notin @(0, 99)) { break }
}
$outcomes | ConvertTo-Json | Set-Content -Encoding UTF8 "$projectRoot/.tools/k6/results/run-outcomes.json"
$outcomes | ForEach-Object { Write-Output "Users=$($_.users), mode=$($_.mode), exit=$($_.exit_code)" }
