$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$runtime = Join-Path $projectRoot '.tools/browserstack'
New-Item -ItemType Directory -Force -Path $runtime | Out-Null
Write-Host 'Find your Automate Username and Access Key at https://www.browserstack.com/accounts/settings'
$account = (Read-Host 'BrowserStack Automate Username').Trim()
$secureKey = Read-Host 'BrowserStack Access Key (hidden)' -AsSecureString
if ([string]::IsNullOrWhiteSpace($account) -or $secureKey.Length -eq 0) { throw 'Username and Access Key are required.' }
$plainKey = $null
$headerValue = $null
try {
    $plainKey = [System.Net.NetworkCredential]::new('', $secureKey).Password.Trim()
    $headerValue = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($account + ':' + $plainKey))
    try {
        $plan = Invoke-RestMethod -Uri 'https://api.browserstack.com/automate/plan.json' -Headers @{Authorization = "Basic $headerValue"} -TimeoutSec 30
    } catch {
        throw 'BrowserStack Automate login could not be verified. Check your Automate Username, Access Key, and account access.'
    }
    $cleanKey = ConvertTo-SecureString $plainKey -AsPlainText -Force
    $config = @{ username = $account; protectedAccessKey = (ConvertFrom-SecureString $cleanKey); savedAtUtc = [DateTime]::UtcNow.ToString('o') }
    $cleanKey.Dispose()
    $config | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $runtime 'credentials.json') -Encoding UTF8
    Write-Host 'BrowserStack credentials verified and saved with Windows user encryption.'
    if ($null -ne $plan.parallel_sessions_max_allowed) { Write-Host "Automate parallel-session limit: $($plan.parallel_sessions_max_allowed)" }
} finally {
    $plainKey = $null
    $headerValue = $null
    $secureKey.Dispose()
}
