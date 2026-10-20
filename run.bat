@echo off
setlocal EnableExtensions DisableDelayedExpansion
rem ==========================================================================
rem  LeptoShield launcher - WINDOWS (cmd.exe). Just double-click this file.
rem
rem  macOS users: double-click run.command instead - same features.
rem
rem    run.bat            check/install everything, build if needed, serve
rem                       on port 8000 bound to every network interface
rem    run.bat dev        Vite hot-reload on 5173 + API on 8000
rem    run.bat check      only check dependencies, install nothing
rem    run.bat firewall   allow ports 8000 and 5173 through Windows Firewall
rem
rem  The desktop opens http://localhost:8000
rem  A phone on the same Wi-Fi opens the "Mobile" URL printed below.
rem  Set LEPTOSHIELD_NO_BROWSER=1 to skip auto-opening a browser.
rem ==========================================================================

title LeptoShield launcher
cd /d "%~dp0"

set "ROOT=%~dp0"
set "BACKEND=%ROOT%backend"
set "FRONTEND=%ROOT%frontend"
set "VENV=%BACKEND%\.venv"
set "VPY=%VENV%\Scripts\python.exe"
set "PYEXE="
set "NPMEXE="
set "PORT=8000"
set "DEV_PORT=5173"
set "MODE=%~1"

if /i "%MODE%"=="firewall" goto firewall
if /i "%MODE%"=="help" goto usage
if /i "%MODE%"=="-h" goto usage
if /i "%MODE%"=="--help" goto usage

call :refresh_path
if /i "%MODE%"=="check" goto doctor

echo.
echo   Checking dependencies...
call :ensure_python
if not defined PYEXE goto no_python
call :ensure_node
if not defined NPMEXE goto no_npm
call :ensure_py_deps
if errorlevel 1 goto pip_failed
call :ensure_web_deps
if errorlevel 1 goto npm_failed

if /i "%MODE%"=="dev" goto dev
goto prod


rem ============================ PRODUCTION ===================================
:prod
call :ensure_build
if errorlevel 1 goto build_failed

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
"%VPY%" -m uvicorn main:app --host 0.0.0.0 --port %PORT%
echo.
echo   Server stopped.
pause
goto :eof


rem ================================ DEV =====================================
:dev
call :ensure_build
if errorlevel 1 goto build_failed

call :port_state
if not "%PORT_STATE%"=="free" goto dev_port_busy

call :lan_ip
set "URLPORT=%DEV_PORT%"
call :banner

start "LeptoShield API" /min /d "%BACKEND%" "%VPY%" -m uvicorn main:app --host 0.0.0.0 --port %PORT%
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


rem =============================== DOCTOR ===================================
:doctor
echo.
echo   Dependency check - nothing is installed by this mode.
echo.
call :find_python
if not defined PYEXE goto doctor_py_missing
call :py_version
echo     [ok] Python %PYVER%
goto doctor_py_done
:doctor_py_missing
echo     [--] Python 3.10+ is missing and will be installed on next run
:doctor_py_done
call :probe_node
if not defined NPMEXE goto doctor_node_missing
for /f "usebackq delims=" %%V in (`node --version`) do echo     [ok] Node.js %%V
goto doctor_node_done
:doctor_node_missing
echo     [--] Node.js 18+ is missing and will be installed on next run
:doctor_node_done
if exist "%VPY%" (
  echo     [ok] Python packages: backend\.venv
) else (
  echo     [--] Python packages: not installed yet
)
if exist "%FRONTEND%\node_modules" (
  echo     [ok] Web packages: frontend\node_modules
) else (
  echo     [--] Web packages: not installed yet
)
if exist "%FRONTEND%\dist\index.html" (
  echo     [ok] Web build: frontend\dist
) else (
  echo     [--] Web build: not built yet
)
echo.
echo   Run run.bat with no arguments to install what is missing and start.
echo.
pause
goto :eof


rem ============================== HELPERS ===================================
:refresh_path
rem Re-read PATH from the registry so freshly installed tools are visible now.
set "PATH_NEW="
for /f "usebackq delims=" %%P in (`powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')" 2^>nul`) do set "PATH_NEW=%%P"
if defined PATH_NEW set "PATH=%PATH_NEW%"
exit /b 0

:py_version
set "PYVER="
set "PYVERFILE=%TEMP%\leptoshield_pyver.txt"
"%PYEXE%" -c "import platform;print(platform.python_version())" > "%PYVERFILE%" 2>nul
if exist "%PYVERFILE%" (
  set /p PYVER=<"%PYVERFILE%"
  del "%PYVERFILE%" >nul 2>&1
)
if not defined PYVER set "PYVER=unknown"
exit /b 0

:have
where %~1 >nul 2>&1
if errorlevel 1 exit /b 1
exit /b 0

:find_python
set "PYEXE="
call :resolve_python python
if defined PYEXE exit /b 0
call :resolve_python py -3
if defined PYEXE exit /b 0
call :find_python_dirs
exit /b 0

:resolve_python
rem %* is a candidate command such as "python" or "py -3"
set "PY_CAND="
for /f "usebackq delims=" %%P in (`%* -c "import sys;print(sys.executable)" 2^>nul`) do set "PY_CAND=%%P"
if not defined PY_CAND exit /b 0
if not exist "%PY_CAND%" exit /b 0
echo %PY_CAND% | find /i "WindowsApps" >nul && exit /b 0
"%PY_CAND%" -c "import sys;sys.exit(0 if sys.version_info>=(3,10) else 1)" >nul 2>&1
if errorlevel 1 exit /b 0
set "PYEXE=%PY_CAND%"
exit /b 0

:try_python_path
if defined PYEXE exit /b 0
if not exist "%~1" exit /b 0
"%~1" -c "import sys;sys.exit(0 if sys.version_info>=(3,10) else 1)" >nul 2>&1
if errorlevel 1 exit /b 0
set "PYEXE=%~1"
exit /b 0

:find_python_dirs
set "PYEXE="
if exist "%LOCALAPPDATA%\Programs\Python" (
  for /d %%D in ("%LOCALAPPDATA%\Programs\Python\Python3*") do call :try_python_path "%%~fD\python.exe"
)
if defined PYEXE exit /b 0
if exist "%ProgramFiles%" (
  for /d %%D in ("%ProgramFiles%\Python3*") do call :try_python_path "%%~fD\python.exe"
)
if defined PYEXE exit /b 0
if exist "%ProgramFiles(x86)%" (
  for /d %%D in ("%ProgramFiles(x86)%\Python3*") do call :try_python_path "%%~fD\python.exe"
)
if defined PYEXE exit /b 0
for /d %%D in ("C:\Python3*") do call :try_python_path "%%~fD\python.exe"
exit /b 0

:ensure_python
set "PYEXE="
call :find_python
if not defined PYEXE goto ensure_python_install
call :py_version
echo   [ok] Python %PYVER%
exit /b 0
:ensure_python_install
echo.
echo   [..] Python 3.10+ was not found. Installing it now - one time only.
call :install_python
call :refresh_path
call :find_python
if defined PYEXE (
  echo   [ok] Python installed
  exit /b 0
)
echo   [X] Python could not be installed automatically.
exit /b 0

:install_python
call :have winget
if not errorlevel 1 (
  echo       Trying winget...
  winget install --id Python.Python.3.12 -e --source winget --silent --accept-package-agreements --accept-source-agreements
  call :refresh_path
  call :find_python
  if defined PYEXE exit /b 0
)
call :have choco
if not errorlevel 1 (
  echo       Trying Chocolatey...
  call choco install python -y
  call :refresh_path
  call :find_python
  if defined PYEXE exit /b 0
)
echo       Downloading the official installer from python.org...
call :download_python
call :refresh_path
call :find_python
exit /b 0

:download_python
set "PYINST=%TEMP%\leptoshield-python-setup.exe"
set "PYURL=https://www.python.org/ftp/python/3.12.10/python-3.12.10-amd64.exe"
if /i "%PROCESSOR_ARCHITECTURE%"=="ARM64" set "PYURL=https://www.python.org/ftp/python/3.12.10/python-3.12.10-arm64.exe"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%PYURL%' -OutFile '%PYINST%' -UseBasicParsing"
if errorlevel 1 exit /b 1
if not exist "%PYINST%" exit /b 1
echo       Running the Python installer...
"%PYINST%" /quiet InstallAllUsers=0 PrependPath=1 Include_test=0 Include_launcher=1
del "%PYINST%" >nul 2>&1
exit /b 0

:probe_node
set "NPMEXE="
where node >nul 2>&1
if errorlevel 1 exit /b 0
node -e "process.exit(parseInt(process.versions.node,10)>=18?0:1)" >nul 2>&1
if errorlevel 1 exit /b 0
where npm >nul 2>&1
if errorlevel 1 exit /b 0
set "NPMEXE=npm"
exit /b 0

:ensure_node
call :probe_node
if defined NPMEXE (
  for /f "usebackq delims=" %%V in (`node --version`) do echo   [ok] Node.js %%V
  exit /b 0
)
echo.
echo   [..] Node.js 18+ was not found. Installing it now - one time only.
call :install_node
call :refresh_path
call :probe_node
if defined NPMEXE (
  echo   [ok] Node.js installed
  exit /b 0
)
echo   [X] Node.js could not be installed automatically.
exit /b 0

:install_node
call :have winget
if not errorlevel 1 (
  echo       Trying winget...
  winget install --id OpenJS.NodeJS.LTS -e --source winget --silent --accept-package-agreements --accept-source-agreements
  call :refresh_path
  call :probe_node
  if defined NPMEXE exit /b 0
)
call :have choco
if not errorlevel 1 (
  echo       Trying Chocolatey...
  call choco install nodejs-lts -y
  call :refresh_path
  call :probe_node
  if defined NPMEXE exit /b 0
)
echo       Downloading the official installer from nodejs.org...
call :download_node
call :refresh_path
call :probe_node
exit /b 0

:download_node
set "NODEMSI=%TEMP%\leptoshield-node-setup.msi"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; $rel = Invoke-RestMethod -Uri 'https://nodejs.org/dist/index.json'; $lts = $rel | Where-Object { $_.lts } | Select-Object -First 1; $arch = 'x64'; if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { $arch = 'arm64' }; $url = 'https://nodejs.org/dist/' + $lts.version + '/node-' + $lts.version + '-' + $arch + '.msi'; Invoke-WebRequest -Uri $url -OutFile '%NODEMSI%' -UseBasicParsing"
if errorlevel 1 exit /b 1
if not exist "%NODEMSI%" exit /b 1
echo       Running the Node.js installer...
msiexec /i "%NODEMSI%" /qn /norestart
del "%NODEMSI%" >nul 2>&1
exit /b 0

:ensure_py_deps
if not exist "%VPY%" (
  echo   [..] Creating the Python environment - backend\.venv...
  "%PYEXE%" -m venv "%VENV%"
)
if not exist "%VPY%" (
  echo   [X] Could not create backend\.venv with:
  echo       %PYEXE%
  exit /b 1
)
"%VPY%" -m pip install --disable-pip-version-check --quiet --upgrade pip >nul 2>&1
call :py_deps_need_install
if not errorlevel 1 (
  echo   [ok] Python packages
  exit /b 0
)
echo   [..] Installing Python packages...
"%VPY%" -m pip install --disable-pip-version-check -r "%BACKEND%\requirements.txt"
if errorlevel 1 exit /b 1
> "%VENV%\.deps-ok" echo ok
call :py_deps_need_install
if errorlevel 1 (
  echo   [X] The Python packages are installed but still cannot be imported.
  exit /b 1
)
echo   [ok] Python packages
exit /b 0

:py_deps_need_install
rem errorlevel 1 means the packages must be installed or refreshed
"%VPY%" -c "import fastapi, uvicorn, sqlmodel, pydantic" >nul 2>&1
if errorlevel 1 exit /b 1
if not exist "%VENV%\.deps-ok" exit /b 1
powershell -NoProfile -Command "if ((Get-Item -LiteralPath '%BACKEND%\requirements.txt').LastWriteTime -gt (Get-Item -LiteralPath '%VENV%\.deps-ok').LastWriteTime) { exit 1 } else { exit 0 }" >nul 2>&1
if errorlevel 1 exit /b 1
exit /b 0

:ensure_web_deps
set "NEED_NPM=0"
if not exist "%FRONTEND%\node_modules" set "NEED_NPM=1"
if "%NEED_NPM%"=="0" (
  pushd "%FRONTEND%"
  powershell -NoProfile -Command "if ((Get-Item -LiteralPath 'package.json').LastWriteTime -gt (Get-Item -LiteralPath 'node_modules').LastWriteTime) { exit 1 } else { exit 0 }" >nul 2>&1
  if errorlevel 1 set "NEED_NPM=1"
  popd
)
if "%NEED_NPM%"=="0" (
  echo   [ok] Web packages
  exit /b 0
)
echo   [..] Installing web packages...
pushd "%FRONTEND%"
call npm install --no-fund --no-audit
if errorlevel 1 (
  popd
  exit /b 1
)
popd
echo   [ok] Web packages
exit /b 0

:ensure_build
if exist "%FRONTEND%\dist\index.html" (
  pushd "%FRONTEND%"
  powershell -NoProfile -Command "$ErrorActionPreference='SilentlyContinue'; $dist = Get-Item -LiteralPath 'dist\index.html'; $src = Get-ChildItem -Path 'src' -Recurse -File; $extra = @('index.html','package.json','vite.config.js','tailwind.config.js','postcss.config.js') | ForEach-Object { Get-Item -LiteralPath $_ }; $newest = (@($src) + @($extra) | Sort-Object LastWriteTime -Descending | Select-Object -First 1).LastWriteTime; if ($newest -gt $dist.LastWriteTime) { exit 1 } else { exit 0 }" >nul 2>&1
  if not errorlevel 1 (
    popd
    echo   [ok] Web build
    exit /b 0
  )
  popd
)
echo   [..] Building the web app. This takes about a minute...
pushd "%FRONTEND%"
call npm run build
set "BUILD_RC=%errorlevel%"
popd
if not "%BUILD_RC%"=="0" exit /b 1
if not exist "%FRONTEND%\dist\index.html" exit /b 1
echo   [ok] Web build
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

:usage
echo.
echo    run.bat            check/install everything and start on port 8000
echo    run.bat dev        Vite hot-reload on 5173 + API on 8000
echo    run.bat check      only check dependencies, install nothing
echo    run.bat firewall   allow ports 8000 and 5173 through Windows Firewall
echo.
echo    On macOS, double-click run.command instead of this file.
echo.
pause
goto :eof


rem ============================== ERRORS ====================================
:no_python
echo.
echo   [X] Python 3.10+ is still missing.
echo       Install it from python.org and tick "Add python.exe to PATH",
echo       or install it with:  winget install Python.Python.3.12
echo       Then run this file again.
echo.
pause
goto :eof

:no_npm
echo.
echo   [X] Node.js 18+ is still missing.
echo       Install it from nodejs.org, or run:
echo         winget install OpenJS.NodeJS.LTS
echo       Then run this file again.
echo.
pause
goto :eof

:pip_failed
echo.
echo   [X] Installing the Python packages failed.
echo       Run this manually to see why:
echo         "%VPY%" -m pip install -r backend\requirements.txt
echo.
pause
goto :eof

:npm_failed
echo.
echo   [X] Installing the web packages failed.
echo       Run this manually to see why:
echo         cd frontend
echo         npm install
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
