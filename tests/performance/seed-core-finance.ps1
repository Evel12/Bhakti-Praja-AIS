$ErrorActionPreference='Stop'
$root=(Resolve-Path "$PSScriptRoot/../..").Path.Replace('\','/')
$env:DB_CONNECTION='sqlite'
$env:DB_DATABASE="$root/.tools/k6/k6-lms.sqlite"
$env:DB_URL=''
$env:APP_ENV='k6'
$env:APP_DEBUG='false'
$env:CACHE_STORE='file'
$env:LARAVEL_STORAGE_PATH="$root/.tools/k6/storage"
& php "$PSScriptRoot/seed-core-finance.php"
if($LASTEXITCODE -ne 0){throw 'Core/finance fixture failed.'}
& php "$root/tests/browserstack/seed-core-finance-profiles.php"
if($LASTEXITCODE -ne 0){throw 'Browser profile fixture failed.'}
