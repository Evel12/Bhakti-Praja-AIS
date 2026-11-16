param([switch]$Local, [switch]$Variants, [switch]$MobileOnly, [string]$Only, [switch]$CoreFinance, [ValidateRange(1,3)][int]$Parallel=1)
$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$oldUser = $env:BROWSERSTACK_USERNAME
$oldKey = $env:BROWSERSTACK_ACCESS_KEY
$secureKey = $null
$exitCode = 1
try {
    if (!$Local -and (!$env:BROWSERSTACK_USERNAME -or !$env:BROWSERSTACK_ACCESS_KEY)) {
        $configPath = Join-Path $projectRoot '.tools/browserstack/credentials.json'
        if (!(Test-Path -LiteralPath $configPath)) { throw 'Run tests/browserstack/connect.ps1 first.' }
        $config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
        $secureKey = ConvertTo-SecureString $config.protectedAccessKey
        $env:BROWSERSTACK_USERNAME = $config.username
        $env:BROWSERSTACK_ACCESS_KEY = [System.Net.NetworkCredential]::new('', $secureKey).Password
    }
    if ($CoreFinance -and $Only) { & node "$PSScriptRoot/core-finance.cjs" "--only=$Only" "--parallel=$Parallel" }
    elseif ($CoreFinance) { & node "$PSScriptRoot/core-finance.cjs" "--parallel=$Parallel" }
    elseif ($Variants -and $Only) { & node "$PSScriptRoot/variants.cjs" "--only=$Only" }
    elseif ($Variants -and $MobileOnly) { & node "$PSScriptRoot/variants.cjs" --mobile-only }
    elseif ($Variants) { & node "$PSScriptRoot/variants.cjs" }
    elseif ($Local) { & node "$PSScriptRoot/run.cjs" --local }
    else { & node "$PSScriptRoot/run.cjs" }
    $exitCode = $LASTEXITCODE
} finally {
    $env:BROWSERSTACK_USERNAME = $oldUser
    $env:BROWSERSTACK_ACCESS_KEY = $oldKey
    if ($secureKey) { $secureKey.Dispose() }
}
exit $exitCode
