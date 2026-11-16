$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path.Replace('\', '/')
$runtime = "$projectRoot/.tools/browserstack"
New-Item -ItemType Directory -Force -Path "$runtime/results" | Out-Null
if (Get-NetTCPConnection -State Listen -LocalPort 4178 -ErrorAction SilentlyContinue) { throw 'Port 4178 is occupied. If the test app is already running, use run-tests.ps1 instead.' }
if (!(Get-NetTCPConnection -State Listen -LocalPort 8086 -ErrorAction SilentlyContinue)) {
    & "$projectRoot/tests/performance/start-local.ps1"
} else {
    $statePath = "$projectRoot/.tools/k6/server-process.json"
    if (!(Test-Path -LiteralPath $statePath)) { throw 'Port 8086 is occupied by an unknown backend.' }
    $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
    $server = Get-CimInstance Win32_Process -Filter "ProcessId=$($state.pid)"
    if (!$server -or !$server.CommandLine.Replace('\', '/').Contains("$projectRoot/.tools/k6/httpd.conf")) { throw 'The backend is not the isolated test instance.' }
}
$env:DB_CONNECTION = 'sqlite'
$env:DB_DATABASE = "$projectRoot/.tools/k6/k6-lms.sqlite"
$env:DB_URL = ''
$env:APP_ENV = 'k6'
$env:APP_DEBUG = 'false'
$env:CACHE_STORE = 'file'
$env:LARAVEL_STORAGE_PATH = "$projectRoot/.tools/k6/storage"
& php "$PSScriptRoot/seed-accounts.php"
if ($LASTEXITCODE -ne 0) { throw 'Browser test accounts could not be prepared.' }
Push-Location "$projectRoot/frontend"
try {
    & npm.cmd exec -- vite build
    if ($LASTEXITCODE -ne 0) { throw 'Main frontend build failed.' }
} finally { Pop-Location }
$node = (Get-Command node.exe).Source
$process = Start-Process -FilePath $node -ArgumentList @("$PSScriptRoot/server.cjs") -WindowStyle Hidden -PassThru -RedirectStandardOutput "$runtime/frontend.log" -RedirectStandardError "$runtime/frontend-error.log"
@{ pid = $process.Id; script = "$PSScriptRoot/server.cjs"; port = 4178 } | ConvertTo-Json | Set-Content -Encoding UTF8 "$runtime/server-process.json"
Write-Output 'Isolated BrowserStack test app is ready at http://127.0.0.1:4178.'
