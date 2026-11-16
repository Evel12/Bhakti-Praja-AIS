$ErrorActionPreference='Stop'
$root=(Resolve-Path "$PSScriptRoot/../..").Path.Replace('\','/')
$runtime="$root/.tools/uptime"
New-Item -ItemType Directory -Force -Path $runtime|Out-Null
$reuse=$false
foreach($name in @('gateway-process.json','tunnel-process.json')){
 if(Test-Path "$runtime/$name"){$saved=Get-Content "$runtime/$name" -Raw|ConvertFrom-Json;$process=Get-CimInstance Win32_Process -Filter "ProcessId=$($saved.pid)" -ErrorAction SilentlyContinue;if($process){$reuse=$true}}
}
if($reuse){
 $g=Get-Content "$runtime/gateway-process.json" -Raw|ConvertFrom-Json;$t=Get-Content "$runtime/tunnel-process.json" -Raw|ConvertFrom-Json
 $gp=Get-CimInstance Win32_Process -Filter "ProcessId=$($g.pid)";$tp=Get-CimInstance Win32_Process -Filter "ProcessId=$($t.pid)"
 if(!$gp -or !$tp -or !$gp.CommandLine.Replace('\','/').Contains("$root/tests/uptime/gateway.cjs") -or $tp.ExecutablePath.Replace('\','/') -ne "$runtime/cloudflared.exe"){throw 'Saved connection processes are incomplete or do not match this project.'}
}else{
if(!(Get-NetTCPConnection -State Listen -LocalPort 4178 -ErrorAction SilentlyContinue)){& "$root/tests/browserstack/start-local.ps1"}
if(Get-NetTCPConnection -State Listen -LocalPort 4180 -ErrorAction SilentlyContinue){throw 'Port 4180 is occupied.'}
$env:DB_CONNECTION='sqlite';$env:DB_DATABASE="$root/.tools/k6/k6-lms.sqlite";$env:DB_URL='';$env:APP_ENV='k6';$env:APP_DEBUG='false';$env:CACHE_STORE='file';$env:LARAVEL_STORAGE_PATH="$root/.tools/k6/storage"
& php "$PSScriptRoot/seed.php"
if($LASTEXITCODE -ne 0){throw 'Synthetic uptime fixture preparation failed.'}
$node=(Get-Command node.exe).Source
$gateway=Start-Process -FilePath $node -ArgumentList @("$PSScriptRoot/gateway.cjs") -WindowStyle Hidden -PassThru -RedirectStandardOutput "$runtime/gateway.log" -RedirectStandardError "$runtime/gateway-error.log"
@{pid=$gateway.Id;script="$root/tests/uptime/gateway.cjs"}|ConvertTo-Json|Set-Content "$runtime/gateway-process.json" -Encoding UTF8
$binary="$runtime/cloudflared.exe"
$release=Get-Content "$runtime/cloudflared-release.json" -Raw|ConvertFrom-Json
if(('sha256:'+(Get-FileHash -LiteralPath $binary -Algorithm SHA256).Hash.ToLowerInvariant()) -ne $release.digest){throw 'Cloudflared does not match the official release digest.'}
$tunnel=Start-Process -FilePath $binary -ArgumentList @('tunnel','--no-autoupdate','--url','http://127.0.0.1:4180','--protocol','http2') -WindowStyle Hidden -PassThru -RedirectStandardOutput "$runtime/tunnel-output.log" -RedirectStandardError "$runtime/tunnel-error.log"
@{pid=$tunnel.Id;binary=$binary}|ConvertTo-Json|Set-Content "$runtime/tunnel-process.json" -Encoding UTF8
}
$deadline=[DateTime]::UtcNow.AddSeconds(45);$publicUrl=$null
while([DateTime]::UtcNow -lt $deadline){
 $log=Get-Content "$runtime/tunnel-error.log" -Raw -ErrorAction SilentlyContinue
 if($log){$match=[regex]::Match($log,'https://[a-z0-9-]+\.trycloudflare\.com');if($match.Success){$publicUrl=$match.Value;break}}
 Start-Sleep -Seconds 1
}
if(!$publicUrl){throw 'Quick Tunnel URL was not returned. Inspect the private tunnel log.'}
$targets=@(@{name='Bhakti Praja - All data';url="$publicUrl/health/ready"},@{name='Bhakti Praja - Core AIS';url="$publicUrl/health/core"},@{name='Bhakti Praja - LMS';url="$publicUrl/health/lms"},@{name='Bhakti Praja - Finance';url="$publicUrl/health/finance"})
foreach($target in $targets){$target.type='HTTP';$target.interval=300;$target.httpMethodType='GET';$target.desired_status='PAUSED';$target.created=$false}
@{public_url=$publicUrl;created_at=[DateTime]::UtcNow.ToString('o');monitoring_started=$false;mode='quick-tunnel';monitors=$targets}|ConvertTo-Json -Depth 6|Set-Content "$runtime/connection.json" -Encoding UTF8
$targets|ConvertTo-Json -Depth 5|Set-Content "$runtime/monitor-drafts.json" -Encoding UTF8
Write-Output "Cloudflare connected: $publicUrl"
Write-Output 'No uptime monitor or sampling campaign has been started.'
