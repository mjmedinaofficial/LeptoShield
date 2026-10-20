@echo off
setlocal EnableExtensions
title LeptoShield launcher
cd /d "%~dp0"

rem ===========================================================================
rem  LeptoShield - one-click launcher for DESKTOP and MOBILE
rem
rem    run.bat            build if needed, serve the app on port 8000,
rem                       bound to every network interface
rem    run.bat dev        Vite hot-reload on 5173 + API on 8000
rem    run.bat firewall   allow ports 8000 and 5173 through Windows
rem                       Firewall (prompts for administrator)
rem
rem  The desktop opens http://localhost:8000
rem  A phone on the same Wi-Fi opens the "Mobile" URL printed below.
rem  Set LEPTOSHIELD_NO_BROWSER=1 to skip auto-opening a browser.
rem ===========================================================================

set "ROOT=%~dp0"
set "BACKEND=%ROOT%backend"
set "FRONTEND=%ROOT%frontend"
set "PORT=8000"
set "DEV_PORT=5173"
set "MODE=%~1"

if /i "%MODE%"=="firewall" goto firewall
if /i "%MODE%"=="dev" goto dev
goto prod


rem ============================ PRODUCTION ===================================
:prod
call :find_python
if errorlevel 1 goto no_python

call :ensure_deps

if not exist "%FRONTEND%\dist\index.html" (
  echo.
  echo   First run: building the web app. This takes about a minute...
  where npm >nul 2>&1
  if errorlevel 1 goto no_npm
  pushd "%FRONTEND%"
  if not exist "node_modules" call npm install
  call npm run build
  popd
  if not exist "%FRONTEND%\dist\index.html" goto build_failed
)

call :port_state
if "%PORT_STATE%"=="ours" goto already_running
if "%PORT_STATE%"=="other" goto port_conflict

call :lan_ip
set "URLPORT=%PORT%"
call :banner

cd /d "%BACKEND%"
echo   Starting the server. Press Ctrl+C to stop.
echo.
if not defined LEPTOSHIELD_NO_BROWSER start "" /min powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 3; Start-Process 'http://localhost:%PORT%'"
%PY% -m uvicorn main:app --host 0.0.0.0 --port %PORT%
echo.
echo   Server stopped.
pause
goto :eof


rem ================================ DEV =====================================
:dev
call :find_python
if errorlevel 1 goto no_python
call :ensure_deps

where npm >nul 2>&1
if errorlevel 1 goto no_npm
if not exist "%FRONTEND%\node_modules" (
  pushd "%FRONTEND%"
  call npm install
  popd
)

call :port_state
if not "%PORT_STATE%"=="free" goto dev_port_busy

call :lan_ip
set "URLPORT=%DEV_PORT%"
call :banner

start "LeptoShield API" /min /d "%BACKEND%" %PY% -m uvicorn main:app --host 0.0.0.0 --port %PORT%
if not defined LEPTOSHIELD_NO_BROWSER start "" /min powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 4; Start-Process 'http://localhost:%DEV_PORT%'"
echo   Starting Vite with hot reload. Press Ctrl+C to stop.
echo.
cd /d "%FRONTEND%"
call npm run dev -- --host 0.0.0.0
taskkill /F /FI "WINDOWTITLE eq LeptoShield API*" >nul 2>&1
echo.
echo   Dev server stopped.
pause
goto :eof

:dev_port_busy
echo.
echo   [!] Port %PORT% is already in use. Stop that server, then run:
echo         run.bat dev
echo.
pause
goto :eof


rem ============================== FIREWALL ==================================
:firewall
echo.
echo   Requesting administrator access to allow inbound TCP 8000 and 5173...
echo   Choose "Yes" on the Windows prompt.
echo.
powershell -NoProfile -Command "$p = Start-Process netsh -Verb RunAs -Wait -PassThru -ArgumentList 'advfirewall firewall add rule name=LeptoShield-LAN dir=in action=allow protocol=TCP localport=8000,5173 profile=private,domain'; Write-Host ('netsh exit code: ' + $p.ExitCode)"
echo.
echo   Done. Phones on the same Wi-Fi should now be able to connect.
echo   To remove the rule later, run this in an admin prompt:
echo     netsh advfirewall firewall delete rule name=LeptoShield-LAN
echo.
pause
goto :eof


rem ============================== HELPERS ===================================
:find_python
set "PY="
where python >nul 2>&1
if not errorlevel 1 set "PY=python"
if defined PY exit /b 0
where py >nul 2>&1
if not errorlevel 1 set "PY=py"
if defined PY exit /b 0
exit /b 1

:ensure_deps
%PY% -c "import fastapi, uvicorn, sqlmodel" >nul 2>&1
if not errorlevel 1 exit /b 0
echo.
echo   Installing Python packages (first run only)...
pushd "%BACKEND%"
%PY% -m pip install -r requirements.txt
popd
exit /b 0

:lan_ip
set "LANIP="
set "IPTMP=%TEMP%\leptoshield_ip.txt"
powershell -NoProfile -Command "$u=New-Object System.Net.Sockets.UdpClient; $u.Connect('8.8.8.8',80); $u.Client.LocalEndPoint.Address.ToString(); $u.Close()" > "%IPTMP%" 2>nul
if exist "%IPTMP%" (
  set /p LANIP=<"%IPTMP%"
  del "%IPTMP%" >nul 2>&1
)
if "%LANIP%"=="127.0.0.1" set "LANIP="
exit /b 0

:port_state
set "PORT_STATE=free"
powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort %PORT% -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"
if errorlevel 1 exit /b 0
set "PORT_STATE=other"
powershell -NoProfile -Command "try { Invoke-WebRequest 'http://127.0.0.1:%PORT%/api/health' -UseBasicParsing -TimeoutSec 2 | Out-Null; exit 0 } catch { exit 1 }"
if not errorlevel 1 set "PORT_STATE=ours"
exit /b 0

:banner
echo.
echo  ==============================================================
echo    LeptoShield  -  leptospirosis triage ^& fast-track queue
echo  ==============================================================
echo.
echo    Desktop   http://localhost:%URLPORT%
if defined LANIP echo    Mobile    http://%LANIP%:%URLPORT%/triage
if not defined LANIP echo    Mobile    LAN address unavailable - check ipconfig
echo.
echo    Kiosk     http://localhost:%URLPORT%/kiosk
echo    Duty desk http://localhost:%URLPORT%/admin
echo    TV board  http://localhost:%URLPORT%/overhead
echo.
echo    Phones must be on the same Wi-Fi as this PC.
echo    If the phone cannot connect:  run.bat firewall
echo    Open /kiosk through the Mobile URL so its QR points at this PC.
echo  --------------------------------------------------------------
echo.
exit /b 0


rem ============================== ERRORS ====================================
:no_python
echo.
echo   [X] Python was not found on PATH.
echo       Install Python 3.10+ from python.org and tick
echo       "Add python.exe to PATH", then run this file again.
echo.
pause
goto :eof

:no_npm
echo.
echo   [X] Node.js / npm was not found, and the web build is missing.
echo       Install Node.js 18+ from nodejs.org, then run this file again.
echo.
pause
goto :eof

:build_failed
echo.
echo   [X] The web build failed. Run this manually to see why:
echo         cd frontend
echo         npm install
echo         npm run build
echo.
pause
goto :eof

:already_running
call :lan_ip
set "URLPORT=%PORT%"
call :banner
if not defined LEPTOSHIELD_NO_BROWSER start "" "http://localhost:%PORT%"
echo   [!] LeptoShield is already running on port %PORT%.
echo       If your phone cannot reach it, close that server window and run
echo       this launcher again so it binds to all network interfaces.
echo.
pause
goto :eof

:port_conflict
echo.
echo   [!] Port %PORT% is already used by another program.
echo       Find it with:  netstat -ano ^| findstr :%PORT%
echo       Close it, then run this launcher again.
echo.
pause
goto :eof
