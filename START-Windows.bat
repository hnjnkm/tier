@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 goto portable
where npm >nul 2>nul
if errorlevel 1 goto portable
node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=12)?0:1)"
if errorlevel 1 goto portable
node launch\run.mjs
goto finished

:portable
set "MY_TIER_NODE_ARCH=x64"
if /I "%PROCESSOR_ARCHITECTURE%"=="ARM64" set "MY_TIER_NODE_ARCH=arm64"
if /I "%PROCESSOR_ARCHITEW6432%"=="ARM64" set "MY_TIER_NODE_ARCH=arm64"
set "MY_TIER_NODE_DIR=%CD%\.runtime\node-v24.19.0-win-%MY_TIER_NODE_ARCH%"
if exist "%MY_TIER_NODE_DIR%\node.exe" goto runportable
echo Downloading the Node.js runtime. An internet connection is required.
powershell.exe -NoProfile -Command "$ErrorActionPreference='Stop'; $v='v24.19.0'; $f='node-'+$v+'-win-'+$env:MY_TIER_NODE_ARCH+'.zip'; $r=Join-Path (Get-Location) '.runtime'; New-Item -ItemType Directory -Force -Path $r | Out-Null; $zip=Join-Path $r ($f+'.download'); Invoke-WebRequest -UseBasicParsing -Uri ('https://nodejs.org/dist/'+$v+'/'+$f) -OutFile $zip; $s=Invoke-WebRequest -UseBasicParsing -Uri ('https://nodejs.org/dist/'+$v+'/SHASUMS256.txt'); $line=($s.Content -split '\r?\n' | Where-Object { $_ -match ('^[a-f0-9]{64}\s+'+[regex]::Escape($f)+'$') }); if (-not $line) { throw 'Official checksum not found.' }; $expected=($line -split '\s+')[0]; $actual=(Get-FileHash -Path $zip -Algorithm SHA256).Hash; if ($actual.ToLower() -ne $expected) { Remove-Item $zip; throw 'Checksum verification failed.' }; $final=Join-Path $r $f; Move-Item -Force $zip $final; Expand-Archive -Force -Path $final -DestinationPath $r; Remove-Item $final"
if errorlevel 1 goto failed

:runportable
set "PATH=%MY_TIER_NODE_DIR%;%PATH%"
"%MY_TIER_NODE_DIR%\node.exe" launch\run.mjs

:finished
if errorlevel 1 goto failed
exit /b 0

:failed
echo.
echo Could not start my tier. Check the message above and try again.
pause
exit /b 1
