$ErrorActionPreference='Stop'
$root=(Resolve-Path "$PSScriptRoot/../..").Path.Replace('\','/')
$runtime="$root/.tools/uptime"
foreach($name in @('tunnel-process.json','gateway-process.json')){
 $path="$runtime/$name";if(!(Test-Path -LiteralPath $path)){continue}
 $state=Get-Content -LiteralPath $path -Raw|ConvertFrom-Json
 $process=Get-CimInstance Win32_Process -Filter "ProcessId=$($state.pid)" -ErrorAction SilentlyContinue
 if(!$process){continue}
 $expected=if($name -eq 'tunnel-process.json'){"$runtime/cloudflared.exe"}else{"$root/tests/uptime/gateway.cjs"}
 $matches=if($name -eq 'tunnel-process.json'){$process.ExecutablePath.Replace('\','/') -eq $expected}else{$process.Name -eq 'node.exe' -and $process.CommandLine.Replace('\','/').Contains($expected)}
 if(!$matches){throw 'Saved PID does not match the project connection process.'}
 Stop-Process -Id $process.ProcessId
}
Write-Output 'Project Cloudflare tunnel and readiness gateway stopped. No uptime campaign was started.'
