param([switch]$Variants)
$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$runtime = Join-Path $projectRoot '.tools/browserstack'
$config = Get-Content -LiteralPath (Join-Path $runtime 'credentials.json') -Raw | ConvertFrom-Json
$secureKey = ConvertTo-SecureString $config.protectedAccessKey
$resultPath = Join-Path $runtime 'results/browserstack-results.json'
if ($Variants) { $resultPath = Join-Path $runtime 'results/device-matrix.json' }
$document = Get-Content -LiteralPath $resultPath -Raw | ConvertFrom-Json
$plainKey = $null
$auth = $null
try {
    $plainKey = [System.Net.NetworkCredential]::new('', $secureKey).Password
    $auth = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($config.username + ':' + $plainKey))
    foreach ($result in $document.results) {
        if (!$result.session_id) { continue }
        if ($result.session_id -notmatch '^[a-zA-Z0-9_-]+$') { throw 'Unexpected session identifier.' }
        $response = Invoke-RestMethod -Uri "https://api.browserstack.com/automate/sessions/$($result.session_id).json" -Headers @{ Authorization = "Basic $auth" } -TimeoutSec 30
        $session = $response.automation_session
        if (!$session -or $session.hashed_id -ne $result.session_id) { throw 'BrowserStack returned a different session.' }
        $result | Add-Member -NotePropertyName browserstack_status -NotePropertyValue $session.status -Force
        $result | Add-Member -NotePropertyName verified_at -NotePropertyValue ([DateTime]::UtcNow.ToString('o')) -Force
        $result | Add-Member -NotePropertyName provider_platform -NotePropertyValue ([pscustomobject]@{
            os = $session.os; os_version = $session.os_version; device = $session.device;
            browser = $session.browser; browser_version = $session.browser_version
        }) -Force
        if ($Variants) {
            $expectedVersion = $result.requested.os_version
            if ($result.requested.osVersion) { $expectedVersion = $result.requested.osVersion }
            $versionMatches = ([string]$session.os_version -replace '\.0$', '') -eq ([string]$expectedVersion -replace '\.0$', '')
            # Inventory entries such as iOS "17" request the major release;
            # the real device can legitimately report a patch such as 17.3.
            if ([string]$expectedVersion -match '^\d+$') {
                $versionMatches = ([string]$session.os_version).Split('.')[0] -eq [string]$expectedVersion
            }
            $deviceMatches = !$result.requested.deviceName -or $session.device -eq $result.requested.deviceName
            $matches = $versionMatches -and $deviceMatches
            $result | Add-Member -NotePropertyName platform_matches_request -NotePropertyValue $matches -Force
            if (!$matches) {
                $result.status = 'failed'
                $result | Add-Member -NotePropertyName error -NotePropertyValue 'Provider device/OS metadata does not match the requested profile; inspect session.' -Force
            }
        }
        $label = $result.browser
        if ($Variants) { $label = $result.name }
        [pscustomobject]@{ Browser = $label; Session = $result.session_id; LocalResult = $result.status; BrowserStackStatus = $session.status } | ConvertTo-Json -Compress
    }
    $document | ConvertTo-Json -Depth 15 | Set-Content -LiteralPath $resultPath -Encoding UTF8
} finally {
    $plainKey = $null
    $auth = $null
    $secureKey.Dispose()
}
