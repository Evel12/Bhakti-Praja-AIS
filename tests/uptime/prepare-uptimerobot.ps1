# Read-only connection verification and local drafts. Never creates a monitor.
$ErrorActionPreference='Stop'
$root=(Resolve-Path "$PSScriptRoot/../..").Path
$runtime=Join-Path $root '.tools/uptime'
$connection=Get-Content (Join-Path $runtime 'connection.json') -Raw|ConvertFrom-Json
$credentials=Get-Content (Join-Path $runtime 'uptimerobot-credentials.json') -Raw|ConvertFrom-Json
$secure=ConvertTo-SecureString $credentials.protectedApiKey
try{
 $key=[Net.NetworkCredential]::new('',$secure).Password
 $response=Invoke-RestMethod -Uri 'https://api.uptimerobot.com/v3/monitors?limit=100' -Headers @{Authorization="Bearer $key"} -TimeoutSec 30
 if($null -eq $response.data){throw 'Unexpected UptimeRobot API response.'}
 $drafts=@($connection.monitors|ForEach-Object {
  @{friendlyName=$_.name;type='HTTP';url=$_.url;interval=300;timeout=30;httpMethodType='GET';assignedAlertContacts=@()}
 })
 $targets=@($connection.monitors|ForEach-Object {$_.url})
 $matching=@($response.data|Where-Object {$_.url -in $targets}|ForEach-Object {
  $name=$_.friendlyName;if(!$name){$name=$_.name}
  @{id=$_.id;name=$name;status=$_.status;url=$_.url}
 })
 $state=@{
  account_connected=$true;verified_at=[DateTime]::UtcNow.ToString('o');monitoring_started=$false
  observed_account_monitor_count=@($response.data).Count;account_list_has_next_page=[bool]$response.nextLink
  matching_monitors=$matching;draft_count=$drafts.Count;created_monitors=0
  desired_status='PAUSED';provisioning_status='draft-only-no-monitor-created'
  reason='The documented create endpoint has no atomic create-paused field. No create/start calls are made under the do-not-test instruction.'
 }
 $state|ConvertTo-Json -Depth 7|Set-Content -LiteralPath (Join-Path $runtime 'uptimerobot-connection.json') -Encoding UTF8
 @{desired_status='PAUSED';created=$false;activation_authorized=$false;monitor_requests=$drafts}|ConvertTo-Json -Depth 7|Set-Content -LiteralPath (Join-Path $runtime 'uptimerobot-drafts.json') -Encoding UTF8
 [pscustomobject]@{account_connected=$true;drafts=$drafts.Count;matching_monitors=$matching.Count;monitoring_started=$false}|ConvertTo-Json -Compress
}finally{$key=$null;$secure.Dispose()}
