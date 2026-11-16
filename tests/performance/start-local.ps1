param(
    [string]$XamppRoot = 'E:/Apps/Xampp',
    [int]$Port = 8086
)
$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path.Replace('\', '/')
$runtime = "$projectRoot/.tools/k6"
$database = "$runtime/k6-lms.sqlite"
$storage = "$runtime/storage"
foreach ($path in @($runtime, "$runtime/results", "$storage/app/private", "$storage/framework/cache/data", "$storage/framework/sessions", "$storage/framework/views", "$storage/logs")) {
    New-Item -ItemType Directory -Force -Path $path | Out-Null
}
$env:DB_CONNECTION = 'sqlite'
$env:DB_DATABASE = $database
$env:DB_URL = ''
$env:APP_ENV = 'k6'
$env:APP_DEBUG = 'false'
$env:CACHE_STORE = 'file'
$env:SESSION_DRIVER = 'file'
$env:LARAVEL_STORAGE_PATH = $storage
if (!(Test-Path -LiteralPath $database)) {
    New-Item -ItemType File -Path $database | Out-Null
    & "$XamppRoot/php/php.exe" "$projectRoot/backend/artisan" migrate --force
    if ($LASTEXITCODE -ne 0) { throw 'Isolated migrations failed.' }
    & "$XamppRoot/php/php.exe" "$PSScriptRoot/seed-lms.php"
    if ($LASTEXITCODE -ne 0) { throw 'Isolated fixture failed.' }
}
if (!(Test-Path -LiteralPath "$runtime/credentials.json")) { throw 'Missing private test credentials.' }
if (Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue) { throw "Port $Port is already in use." }
$config = @"
ServerRoot "$XamppRoot/apache"
ServerName 127.0.0.1
Listen 127.0.0.1:$Port
PidFile "$runtime/httpd.pid"
LoadModule authz_core_module modules/mod_authz_core.so
LoadModule authz_host_module modules/mod_authz_host.so
LoadModule dir_module modules/mod_dir.so
LoadModule env_module modules/mod_env.so
LoadModule mime_module modules/mod_mime.so
LoadModule rewrite_module modules/mod_rewrite.so
LoadModule log_config_module modules/mod_log_config.so
SetEnv LARAVEL_STORAGE_PATH "$storage"
LoadFile "$XamppRoot/php/php8ts.dll"
LoadFile "$XamppRoot/php/libsqlite3.dll"
LoadModule php_module "$XamppRoot/php/php8apache2_4.dll"
PHPINIDir "$XamppRoot/php"
<FilesMatch "\.php$">
    SetHandler application/x-httpd-php
</FilesMatch>
DocumentRoot "$projectRoot/backend/public"
<Directory "$projectRoot/backend/public">
    Options -Indexes +FollowSymLinks
    AllowOverride All
    Require local
    DirectoryIndex index.php
</Directory>
TypesConfig conf/mime.types
ErrorLog "$runtime/apache-error.log"
LogLevel warn
LogFormat "%h %t %m %U %>s %D" performance
CustomLog "$runtime/apache-access.log" performance
ThreadsPerChild 64
MaxConnectionsPerChild 0
KeepAlive On
KeepAliveTimeout 3
MaxKeepAliveRequests 100
"@
$configPath = "$runtime/httpd.conf"
[IO.File]::WriteAllText($configPath, $config)
& "$XamppRoot/apache/bin/httpd.exe" -t -f $configPath
if ($LASTEXITCODE -ne 0) { throw 'Isolated Apache configuration failed.' }
$server = Start-Process -FilePath "$XamppRoot/apache/bin/httpd.exe" -ArgumentList @('-f', $configPath) -WindowStyle Hidden -PassThru
[IO.File]::WriteAllText("$runtime/server-process.json", (@{ pid = $server.Id; config = $configPath; port = $Port; database = $database } | ConvertTo-Json))
Write-Output "Started isolated Apache PID $($server.Id), 64 threads, http://127.0.0.1:$Port"
