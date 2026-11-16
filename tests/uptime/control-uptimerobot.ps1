[CmdletBinding(SupportsShouldProcess=$true)]
param([ValidateSet('Start','Pause','Status')][string]$Action='Status')
$ErrorActionPreference='Stop'
if($WhatIfPreference){Write-Output "Would perform $Action on the four project monitors only. No API requests sent.";return}
$root=(Resolve-Path "$PSScriptRoot/../..").Path
$runtime=Join-Path $root '.tools/uptime'
$config=Get-Content (Join-Path $runtime 'connection.json') -Raw|ConvertFrom-Json
$credential=Get-Content (Join-Path $runtime 'uptimerobot-credentials.json') -Raw|ConvertFrom-Json
$secure=ConvertTo-SecureString $credential.protectedApiKey
$managedPath=Join-Path $runtime 'managed-monitors.json'
$managed=@();if(Test-Path $managedPath){$managed=@(Get-Content $managedPath -Raw|ConvertFrom-Json)}
$nextRequest=[DateTime]::MinValue
function Invoke-ProjectApi([string]$Method,[string]$Route,$Body=$null){
 # Free accounts allow 10 API calls/minute. Leave spacing and honor 429.
 $delay=($script:nextRequest-[DateTime]::UtcNow).TotalMilliseconds
 if($delay -gt 0){Start-Sleep -Milliseconds ([int][Math]::Ceiling($delay))}
 $script:nextRequest=[DateTime]::UtcNow.AddSeconds(7)
 $parameters=@{Method=$Method;Uri="https://api.uptimerobot.com/v3$Route";Headers=@{Authorization="Bearer $script:key"};TimeoutSec=30}
 if($null -ne $Body){$parameters.ContentType='application/json';$parameters.Body=($Body|ConvertTo-Json -Depth 10 -Compress)}
 for($attempt=0;$attempt -lt 3;$attempt++){
  try{return Invoke-RestMethod @parameters}catch{
   if($_.Exception.Response -and [int]$_.Exception.Response.StatusCode -eq 429 -and $attempt -lt 2){Start-Sleep -Seconds 65;continue}
   throw "UptimeRobot $Method $Route failed. No API key is printed; inspect the account and connection. Previously completed actions are preserved."
  }
 }
}
function Save-Managed {
 [IO.File]::WriteAllText($managedPath,(ConvertTo-Json -InputObject @($script:managed) -Depth 7),[Text.UTF8Encoding]::new($false))
}
try{
 $script:key=[Net.NetworkCredential]::new('',$secure).Password
 if($Action -eq 'Start'){
  $ready=Invoke-RestMethod -Uri "$($config.public_url)/health/ready" -TimeoutSec 30
  if($ready.status -ne 'healthy'){throw 'Public data readiness is not healthy. Restore the app and tunnel before starting.'}
  $listed=Invoke-ProjectApi 'Get' '/monitors?name=Bhakti%20Praja%20-%20&limit=100'
  foreach($draft in $config.monitors){
   $saved=@($managed|Where-Object {$_.name -eq $draft.name})
   if($saved.Count -gt 1){throw 'Duplicate local monitor identities; resolve them before starting.'}
   $entry=if($saved.Count){$saved[0]}else{$null}
   if(!$entry){
    $matches=@($listed.data|Where-Object {($_.friendlyName -eq $draft.name -or $_.name -eq $draft.name) -and $_.url -eq $draft.url})
    if($matches.Count -gt 1){throw 'More than one matching remote monitor; select it manually.'}
    if($matches.Count){$entry=[pscustomobject]@{id=$matches[0].id;name=$draft.name;url=$draft.url};$managed+= $entry;Save-Managed}
   }
   if(!$entry){
    if(!$PSCmdlet.ShouldProcess($draft.name,'Create and start UptimeRobot monitoring')){continue}
    $created=Invoke-ProjectApi 'Post' '/monitors' @{friendlyName=$draft.name;type='HTTP';url=$draft.url;interval=300;timeout=30;httpMethodType='GET';assignedAlertContacts=@()}
    if($created.data){$created=$created.data}
    if(!$created.id){throw 'Provider returned no monitor ID. Check dashboard before retrying to avoid duplicates.'}
    $entry=[pscustomobject]@{id=$created.id;name=$draft.name;url=$draft.url};$managed+=$entry;Save-Managed
   }else{
    if([string]$entry.id -notmatch '^\d+$'){throw 'Invalid saved monitor ID.'}
    $remote=Invoke-ProjectApi 'Get' "/monitors/$($entry.id)"
    if($remote.data){$remote=$remote.data}
    if($remote.url -ne $draft.url){
     if($remote.status -ne 'PAUSED'){Invoke-ProjectApi 'Post' "/monitors/$($entry.id)/pause" @{}|Out-Null}
     Invoke-ProjectApi 'Patch' "/monitors/$($entry.id)" @{url=$draft.url;httpMethodType='GET'}|Out-Null
     $entry.url=$draft.url;Save-Managed;$remote.status='PAUSED'
    }
    if($remote.status -eq 'PAUSED' -and $PSCmdlet.ShouldProcess($entry.name,'Resume UptimeRobot monitoring')){Invoke-ProjectApi 'Post' "/monitors/$($entry.id)/start" @{}|Out-Null}
   }
  }
 }elseif($Action -eq 'Pause'){
  foreach($entry in $managed){
   if([string]$entry.id -notmatch '^\d+$'){throw 'Invalid saved monitor ID.'}
   if($PSCmdlet.ShouldProcess($entry.name,'Pause UptimeRobot monitoring')){Invoke-ProjectApi 'Post' "/monitors/$($entry.id)/pause" @{}|Out-Null}
  }
 }
 $states=@()
 foreach($entry in $managed){
  if([string]$entry.id -notmatch '^\d+$'){throw 'Invalid saved monitor ID.'}
  $r=Invoke-ProjectApi 'Get' "/monitors/$($entry.id)";if($r.data){$r=$r.data}
  $states+=[pscustomobject]@{id=$entry.id;name=$entry.name;url=$entry.url;status=$r.status}
 }
 $states|Format-Table name,status -AutoSize
 $now=[DateTime]::UtcNow.ToString('o')
 @{verified_at=$now;action=$Action;monitors=$states}|ConvertTo-Json -Depth 7|Set-Content (Join-Path $runtime 'provider-status.json') -Encoding UTF8
 if($Action -ne 'Status' -and $states.Count){
  $paused=@($states|Where-Object {$_.status -eq 'PAUSED'}).Count
  $event=if($paused -eq $states.Count){'paused'}elseif($paused -eq 0){'active'}else{'mixed'}
  @{at=$now;state=$event;monitors=$states}|ConvertTo-Json -Depth 7|Set-Content (Join-Path $runtime 'session-state.json') -Encoding UTF8
  @{at=$now;action=$Action;verified_state=$event;monitor_ids=@($states|ForEach-Object {$_.id})}|ConvertTo-Json -Depth 4 -Compress|Add-Content (Join-Path $runtime 'session-events.jsonl') -Encoding UTF8
  Write-Output "Verified monitor state: $event. Keep pauses separate from observed uptime; inspect provider history for exact monitoring timestamps."
 }
 if(!$states.Count){Write-Output 'No project monitors have been created yet.'}
}finally{$script:key=$null;$secure.Dispose()}
