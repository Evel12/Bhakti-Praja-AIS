$ErrorActionPreference='Stop'
$root=(Resolve-Path "$PSScriptRoot/../..").Path
$runtime=Join-Path $root '.tools/uptime'
New-Item -ItemType Directory -Force -Path $runtime|Out-Null
Write-Host 'Masukkan API key UptimeRobot dari Integrations > API. Key hanya dibaca di terminal dan disimpan terenkripsi untuk akun Windows ini.'
$secure=Read-Host 'UptimeRobot account API key' -AsSecureString
if($secure.Length -eq 0){throw 'API key tidak boleh kosong.'}
$plain=$null
try{
 $plain=[Net.NetworkCredential]::new('',$secure).Password.Trim()
 try{$response=Invoke-RestMethod -Uri 'https://api.uptimerobot.com/v3/monitors?limit=1' -Headers @{Authorization="Bearer $plain"} -TimeoutSec 30}catch{throw 'Koneksi UptimeRobot gagal. Periksa API key dan akses akun; key tidak dicetak ke log.'}
 if($null -eq $response.data){throw 'Format respons UptimeRobot tidak sesuai API v3.'}
 @{protectedApiKey=(ConvertFrom-SecureString (ConvertTo-SecureString $plain -AsPlainText -Force));connectedAtUtc=[DateTime]::UtcNow.ToString('o');monitoringStarted=$false}|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $runtime 'uptimerobot-credentials.json') -Encoding UTF8
 Write-Output 'UptimeRobot API connected. Tidak ada monitor dibuat, diaktifkan, atau pengujian dimulai.'
}finally{$plain=$null;$secure.Dispose()}
