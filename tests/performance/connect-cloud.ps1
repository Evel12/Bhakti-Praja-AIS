param([string]$Stack = 'tancoconut1625')

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$executable = Join-Path $projectRoot '.tools/k6/bin/k6-v2.4.0-windows-amd64/k6.exe'
if (!(Test-Path -LiteralPath $executable)) {
    throw 'The local k6 executable was not found.'
}

Write-Host 'Paste your Grafana k6 Personal token at the prompt, then press Enter.'
Write-Host 'The token is hidden while you enter it.'
$secureToken = Read-Host 'k6 token' -AsSecureString
if ($secureToken.Length -eq 0) {
    throw 'No token was entered. Run this script again and paste the token at the k6 token prompt.'
}

$plainToken = $null
$loginExit = 1
try {
    $plainToken = [System.Net.NetworkCredential]::new('', $secureToken).Password.Trim()
    if ([string]::IsNullOrWhiteSpace($plainToken)) { throw 'The token is blank.' }
    & $executable cloud login --stack $Stack "--token=$plainToken"
    $loginExit = $LASTEXITCODE
} finally {
    $plainToken = $null
    $secureToken.Dispose()
}
exit $loginExit
