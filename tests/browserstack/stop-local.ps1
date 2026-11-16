$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path.Replace('\', '/')
$statePath = "$projectRoot/.tools/browserstack/server-process.json"
if (Test-Path -LiteralPath $statePath) {
    $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
    $server = Get-CimInstance Win32_Process -Filter "ProcessId=$($state.pid)"
    if ($server) {
        if ($server.Name -ne 'node.exe' -or !$server.CommandLine.Replace('\', '/').Contains("$projectRoot/tests/browserstack/server.cjs")) {
            throw 'The saved PID is not the isolated browser test server.'
        }
        Stop-Process -Id $state.pid -ErrorAction SilentlyContinue
    }
}
& "$projectRoot/tests/performance/stop-local.ps1"
Write-Output 'Stopped the isolated browser test app.'
