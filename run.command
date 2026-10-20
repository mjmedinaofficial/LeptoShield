#!/bin/bash
# ==========================================================================
#  LeptoShield launcher - macOS / Linux
#
#  Double-click this file in Finder, or in Terminal:
#      chmod +x run.command      (once, so Finder can launch it)
#      ./run.command
#
#  Use run.bat instead on Windows.
#
#    ./run.command            check/install everything, build if needed,
#                             serve on port 8000, bound to every interface
#    ./run.command dev        Vite hot-reload on 5173 + API on 8000
#    ./run.command check      only check dependencies, install nothing
#    ./run.command help       this text
#
#  The desktop opens http://localhost:8000
#  A phone on the same Wi-Fi opens the "Mobile" URL printed below.
#  Set LEPTOSHIELD_NO_BROWSER=1 to skip auto-opening a browser.
# ==========================================================================

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
VENV="$BACKEND/.venv"
VPY="$VENV/bin/python"
PORT=8000
DEV_PORT=5173
MODE=${1:-}

say()  { printf '\n  %s\n' "$*"; }
ok()   { printf '  [ok] %s\n' "$*"; }
step() { printf '  [..] %s\n' "$*"; }
hold() { if [ -t 0 ]; then printf '\n  Press Return to close this window...'; read -r _; fi; }
die()  { printf '\n  [X] %s\n' "$*" >&2; hold; exit 1; }

have()      { command -v "$1" >/dev/null 2>&1; }
python_ok() { "$1" -c 'import sys; sys.exit(0 if sys.version_info >= (3,10) else 1)' >/dev/null 2>&1; }
node_ok()   { have node && have npm && node -e 'process.exit(parseInt(process.versions.node,10)>=18?0:1)' >/dev/null 2>&1; }

find_python() {
  PY=
  for c in python3 python3.13 python3.12 python3.11 python3.10 python; do
    if have "$c" && python_ok "$c"; then PY=$(command -v "$c"); return 0; fi
  done
  return 1
}

brew_shellenv() {
  if [ -x /opt/homebrew/bin/brew ]; then eval "$(/opt/homebrew/bin/brew shellenv)"
  elif [ -x /usr/local/bin/brew ]; then eval "$(/usr/local/bin/brew shellenv)"
  fi
}

install_python() {
  if [ "$(uname -s)" = "Darwin" ]; then
    have brew || brew_shellenv
    if ! have brew; then
      step "Homebrew is missing. Installing Homebrew (it asks for your Mac password)."
      have curl || die "curl is required to install Homebrew."
      /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" || die "Homebrew installation failed."
      brew_shellenv
    fi
    have brew || die "Homebrew is still not available. Install it from https://brew.sh and try again."
    step "Installing Python with Homebrew..."
    brew install python || die "Homebrew could not install Python."
  elif have apt-get; then
    step "Installing Python with apt-get. You may be asked for your password."
    sudo apt-get update && sudo apt-get install -y python3 python3-venv python3-pip || die "apt-get could not install Python."
  elif have dnf; then
    step "Installing Python with dnf."
    sudo dnf install -y python3 python3-pip || die "dnf could not install Python."
  elif have pacman; then
    step "Installing Python with pacman."
    sudo pacman -S --noconfirm python python-pip || die "pacman could not install Python."
  else
    die "Install Python 3.10+ from https://www.python.org/downloads/ and run this again."
  fi
}

install_node() {
  if [ "$(uname -s)" = "Darwin" ]; then
    have brew || brew_shellenv
    have brew || die "Homebrew is required to install Node.js on macOS."
    step "Installing Node.js with Homebrew..."
    brew install node || die "Homebrew could not install Node.js."
  elif have apt-get; then
    step "Installing Node.js with apt-get."
    sudo apt-get install -y nodejs npm || die "apt-get could not install Node.js."
  elif have dnf; then
    step "Installing Node.js with dnf."
    sudo dnf install -y nodejs npm || die "dnf could not install Node.js."
  elif have pacman; then
    step "Installing Node.js with pacman."
    sudo pacman -S --noconfirm nodejs npm || die "pacman could not install Node.js."
  else
    die "Install Node.js 18+ from https://nodejs.org and run this again."
  fi
}

lan_ip() {
  ip=
  if have ipconfig; then ip=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null); fi
  if [ -z "$ip" ] && have hostname; then ip=$(hostname -I 2>/dev/null | awk '{print $1}'); fi
  case "$ip" in 127.*) ip= ;; esac
  printf '%s' "$ip"
}

banner() {
  ip=$1
  printf '\n  ==============================================================\n'
  printf '    LeptoShield  -  leptospirosis triage & fast-track queue\n'
  printf '  ==============================================================\n\n'
  printf '    Desktop   http://localhost:%s\n' "$2"
  if [ -n "$ip" ]; then
    printf '    Mobile    http://%s:%s/triage\n' "$ip" "$2"
  else
    printf '    Mobile    LAN address unavailable - check your network settings\n'
  fi
  printf '\n    Kiosk     http://localhost:%s/kiosk\n' "$2"
  printf '    Duty desk http://localhost:%s/admin\n' "$2"
  printf '    TV board  http://localhost:%s/overhead\n' "$2"
  printf '\n    Phones must be on the same Wi-Fi as this computer.\n'
  printf '    If a phone cannot connect, allow incoming connections for\n'
  printf '    "python" in System Settings > Network > Firewall.\n'
  printf '  --------------------------------------------------------------\n\n'
}

open_browser() {
  if [ "$(uname -s)" = "Darwin" ]; then
    ( sleep "$1"; open "http://localhost:$2" >/dev/null 2>&1 ) &
  elif have xdg-open; then
    ( sleep "$1"; xdg-open "http://localhost:$2" >/dev/null 2>&1 ) &
  fi
}

port_listening() { lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1; }
port_is_ours()  { curl -fsS --max-time 2 "http://127.0.0.1:$1/api/health" >/dev/null 2>&1; }

printf '\n  LeptoShield launcher for %s\n' "$(uname -s)"

if [ "$MODE" = "firewall" ] || [ "$MODE" = "help" ] || [ "$MODE" = "-h" ] || [ "$MODE" = "--help" ]; then
  say "Usage"
  printf '    ./run.command           start the app on port %s\n' "$PORT"
  printf '    ./run.command dev       Vite hot-reload on %s + API on %s\n' "$DEV_PORT" "$PORT"
  printf '    ./run.command check     only check dependencies, install nothing\n'
  printf '    ./run.command help      this text\n'
  printf '\n    Windows: double-click run.bat instead.\n'
  printf '\n    macOS firewall: open System Settings > Network > Firewall and\n'
  printf '    allow incoming connections for "python" when macOS asks.\n'
  printf '    Linux: allow TCP %s and %s with your firewall tool (ufw, firewalld).\n' "$PORT" "$DEV_PORT"
  printf '\n'
  hold
  exit 0
fi

say "Checking dependencies"

if find_python; then
  ok "Python $("$PY" -c 'import platform;print(platform.python_version())')"
else
  step "Python 3.10+ not found - installing it now (one time only)."
  install_python
  find_python || die "Python was installed but could not be found. Open a new Terminal and run this file again."
  ok "Python installed"
fi

if node_ok; then
  ok "Node.js $(node --version)"
else
  step "Node.js 18+ not found - installing it now (one time only)."
  install_node
  node_ok || die "Node.js was installed but could not be found. Open a new Terminal and run this file again."
  ok "Node.js installed"
fi

if [ "$MODE" = "check" ]; then
  [ -x "$VPY" ] && ok "Python packages: backend/.venv" || step "Python packages: not installed yet"
  [ -d "$FRONTEND/node_modules" ] && ok "Web packages: frontend/node_modules" || step "Web packages: not installed yet"
  [ -f "$FRONTEND/dist/index.html" ] && ok "Web build: frontend/dist" || step "Web build: not built yet"
  printf '\n  Everything needed is ready. Double-click this file again to start.\n'
  hold
  exit 0
fi

if [ ! -x "$VPY" ]; then
  if [ -d "$VENV" ]; then
    step "Replacing the existing virtual environment with a fresh one."
    rm -rf "$VENV"
  fi
  step "Creating the Python environment (backend/.venv)..."
  "$PY" -m venv "$VENV" || die "Could not create backend/.venv. On Debian/Ubuntu run: sudo apt install python3-venv"
fi

if [ ! -f "$VENV/.deps-ok" ] || [ "$BACKEND/requirements.txt" -nt "$VENV/.deps-ok" ]; then
  step "Installing Python packages..."
  "$VPY" -m pip install --disable-pip-version-check --quiet --upgrade pip
  "$VPY" -m pip install --disable-pip-version-check -r "$BACKEND/requirements.txt" || die "Installing Python packages failed."
  : > "$VENV/.deps-ok"
fi

if [ ! -d "$FRONTEND/node_modules" ] || [ "$FRONTEND/package.json" -nt "$FRONTEND/node_modules" ]; then
  step "Installing web packages..."
  ( cd "$FRONTEND" && npm install --no-fund --no-audit ) || die "npm install failed."
fi

NEED_BUILD=0
if [ ! -f "$FRONTEND/dist/index.html" ]; then
  NEED_BUILD=1
elif [ -n "$(find "$FRONTEND/src" "$FRONTEND/index.html" -newer "$FRONTEND/dist/index.html" 2>/dev/null | head -n 1)" ]; then
  NEED_BUILD=1
fi
if [ "$NEED_BUILD" = "1" ]; then
  step "Building the web app. This takes about a minute..."
  ( cd "$FRONTEND" && npm run build ) || die "The web build failed. Run 'npm install && npm run build' in frontend to see why."
fi

IP=$(lan_ip)

if [ "$MODE" = "dev" ]; then
  if port_listening "$PORT"; then
    die "Port $PORT is already in use. Stop that program, then run this again."
  fi
  banner "$IP" "$DEV_PORT"
  "$VPY" -m uvicorn main:app --app-dir "$BACKEND" --host 0.0.0.0 --port "$PORT" &
  API_PID=$!
  trap 'kill "$API_PID" 2>/dev/null' EXIT INT TERM
  [ -z "$LEPTOSHIELD_NO_BROWSER" ] && open_browser 4 "$DEV_PORT"
  printf '  Starting Vite with hot reload. Press Ctrl+C to stop.\n\n'
  ( cd "$FRONTEND" && npm run dev -- --host 0.0.0.0 )
  printf '\n  Dev server stopped.\n'
  hold
  exit 0
fi

if port_listening "$PORT"; then
  if port_is_ours "$PORT"; then
    banner "$IP" "$PORT"
    printf '  [!] LeptoShield is already running on port %s.\n' "$PORT"
    printf '      Close that server window first if you want a fresh start.\n'
    hold
    exit 0
  fi
  die "Port $PORT is already used by another program. Close it, then run this again."
fi

banner "$IP" "$PORT"
printf '  Starting the server. Press Ctrl+C to stop.\n\n'
[ -z "$LEPTOSHIELD_NO_BROWSER" ] && open_browser 3 "$PORT"

cd "$BACKEND" || die "The backend folder is missing."
"$VPY" -m uvicorn main:app --host 0.0.0.0 --port "$PORT"
printf '\n  Server stopped.\n'
hold
exit 0
