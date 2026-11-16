param([string[]]$Modules=@('core','finance'),[int[]]$Users=@(10,25,50),[switch]$Local)
$ErrorActionPreference='Stop'
$root=(Resolve-Path "$PSScriptRoot/../..").Path.Replace('\','/')
$k6="$root/.tools/k6/bin/k6-v2.4.0-windows-amd64/k6.exe"
$env:BASE_URL='http://127.0.0.1:8086'
$env:K6_WEB_DASHBOARD='true'
$env:K6_WEB_DASHBOARD_PORT='-1'
$env:K6_WEB_DASHBOARD_PERIOD='5s'
$outcomes=@()
foreach($module in $Modules){
 if($module -notin @('core','finance')){throw 'Select core or finance.'}
 $env:TEST_MODULE=$module
 $env:K6_USERS_FILE="$root/.tools/k6/$module-credentials.json"
 foreach($count in $Users){
  if($count -lt 1 -or $count -gt 50){throw 'Supported range is 1 through 50 VUs.'}
  $env:TEST_VUS="$count"
  $mode=if($Local){'local'}else{'cloud'}
  $env:RESULT_PREFIX="$root/.tools/k6/results/$mode-$module-$count"
  $env:K6_WEB_DASHBOARD_EXPORT="$env:RESULT_PREFIX.html"
  $log="$env:RESULT_PREFIX.log"
  $ErrorActionPreference='Continue'
  if($Local){
   & $k6 run --no-usage-report "$PSScriptRoot/core-finance.k6.js" 2>&1 | Tee-Object -FilePath $log
  }else{
   & $k6 cloud run --local-execution --no-archive-upload --no-cloud-logs --no-cloud-secrets --no-usage-report --include-system-env-vars "$PSScriptRoot/core-finance.k6.js" 2>&1 | Tee-Object -FilePath $log
  }
  $code=$LASTEXITCODE
  $ErrorActionPreference='Stop'
  $outcomes+=@{module=$module;users=$count;mode=$mode;exit_code=$code;prefix=$env:RESULT_PREFIX}
  $outcomes|ConvertTo-Json -Depth 5|Set-Content -Encoding UTF8 "$root/.tools/k6/results/core-finance-outcomes.json"
  if($code -notin @(0,99)){throw "k6 $module/$count could not complete. Inspect the private run log."}
 }
}
if(@($outcomes|Where-Object {$_.exit_code -ne 0}).Count){exit 1}
