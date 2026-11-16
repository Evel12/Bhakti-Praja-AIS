$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path.Replace('\', '/')
$statePath = "$projectRoot/.tools/k6/server-process.json"
if (!(Test-Path -LiteralPath $statePath)) { Write-Output 'No saved isolated server.'; exit 0 }
$state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
$server = Get-CimInstance Win32_Process -Filter "ProcessId=$($state.pid)"
if (!$server) { Write-Output 'The isolated server is already stopped.'; exit 0 }
$expectedConfig = "$projectRoot/.tools/k6/httpd.conf"
if ($server.Name -ne 'httpd.exe' -or !$server.CommandLine.Replace('\', '/').Contains($expectedConfig)) {
    throw 'PID no longer matches the isolated Apache instance; no process was stopped.'
}
Get-CimInstance Win32_Process | Where-Object ParentProcessId -eq $state.pid | ForEach-Object { Stop-Process -Id $_.ProcessId -ErrorAction SilentlyContinue }
Stop-Process -Id $state.pid -ErrorAction SilentlyContinue
Write-Output 'Stopped the isolated k6 Apache server.'
