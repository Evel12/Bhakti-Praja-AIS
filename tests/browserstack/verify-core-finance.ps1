$ErrorActionPreference='Stop'
$root=(Resolve-Path "$PSScriptRoot/../..").Path
$runtime=Join-Path $root '.tools/browserstack'
$path=Join-Path $runtime 'results/core-finance/results.json'
$document=Get-Content -LiteralPath $path -Raw|ConvertFrom-Json
if(@($document.results|Where-Object {$_.status -eq 'running'}).Count){throw 'Wait until browser sessions finish.'}
$config=Get-Content (Join-Path $runtime 'credentials.json') -Raw|ConvertFrom-Json
$secure=ConvertTo-SecureString $config.protectedAccessKey
try{
 $key=[Net.NetworkCredential]::new('',$secure).Password
 $auth=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($config.username+':'+$key))
 foreach($r in $document.results){
  if(!$r.session_id){continue}
  if($r.session_id -notmatch '^[a-zA-Z0-9_-]+$'){throw 'Invalid session identifier.'}
  $s=(Invoke-RestMethod "https://api.browserstack.com/automate/sessions/$($r.session_id).json" -Headers @{Authorization="Basic $auth"} -TimeoutSec 30).automation_session
  if($s.hashed_id -ne $r.session_id){throw 'Provider session identity mismatch.'}
  $r.provider.status=$s.status
  $r.verified_at=[DateTime]::UtcNow.ToString('o')
  if($s.browser_url){
   $uri=[uri]$s.browser_url
   if($uri.Scheme -eq 'https' -and $uri.Host -eq 'automate.browserstack.com'){$r.dashboard_url=$uri.GetLeftPart([UriPartial]::Path)}
  }
  [pscustomobject]@{profile=$r.profile;core=$r.module_status.core;finance=$r.module_status.finance;provider=$s.status}|ConvertTo-Json -Compress
 }
 [IO.File]::WriteAllText($path,($document|ConvertTo-Json -Depth 25),[Text.UTF8Encoding]::new($false))
}finally{$key=$null;$auth=$null;$secure.Dispose()}
