# ============================================================
# BOXIFY FULL AUTO INSTALLER (IMPROVED)
# ============================================================
#
# FILE:
# install.ps1
#
# RUN AS ADMINISTRATOR
#
# ============================================================

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Windows.Forms

# ============================================================
# ROOT
# ============================================================

$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path

$BACKEND = "$ROOT\backend"
$FRONTEND = "$ROOT\frontend"
$ASSETS = "$ROOT\assets"

# ============================================================
# HELPERS
# ============================================================

function Info($msg) {
    Write-Host "[INFO] $msg" -ForegroundColor Cyan
}

function Success($msg) {
    Write-Host "[OK] $msg" -ForegroundColor Green
}

function ErrorMsg($msg) {
    Write-Host "[ERROR] $msg" -ForegroundColor Red
}

function Check-Command($cmd) {
    return $null -ne (Get-Command $cmd -ErrorAction SilentlyContinue)
}

# ============================================================
# ADMIN CHECK
# ============================================================

$currentUser = New-Object Security.Principal.WindowsPrincipal `
([Security.Principal.WindowsIdentity]::GetCurrent())

if (!$currentUser.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {

    [System.Windows.Forms.MessageBox]::Show(
        "Please run this installer as Administrator.",
        "Boxify Installer"
    )

    exit
}

# ============================================================
# START
# ============================================================

Clear-Host

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "               BOXIFY INSTALLER                   " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# ============================================================
# PYTHON INSTALL
# ============================================================

Info "Checking Python..."

if (!(Check-Command "python")) {

    Info "Python not found"

    $PYTHON_URL = "https://www.python.org/ftp/python/3.12.9/python-3.12.9-amd64.exe"

    $PYTHON_INSTALLER = "$ROOT\python-installer.exe"

    Info "Downloading Python 3.12..."

    Invoke-WebRequest `
        -Uri $PYTHON_URL `
        -OutFile $PYTHON_INSTALLER

    Success "Python downloaded"

    Info "Installing Python silently..."

    Start-Process `
        -FilePath $PYTHON_INSTALLER `
        -Wait `
        -ArgumentList @(
            "/quiet",
            "InstallAllUsers=1",
            "PrependPath=1",
            "Include_test=0"
        )

    Success "Python installed"
}

Success "Python ready"

# ============================================================
# NODE INSTALL
# ============================================================

Info "Checking Node.js..."

if (!(Check-Command "node")) {

    Info "Node.js not found"

    $NODE_URL = "https://nodejs.org/dist/v22.15.0/node-v22.15.0-x64.msi"

    $NODE_INSTALLER = "$ROOT\node-installer.msi"

    Info "Downloading Node.js..."

    Invoke-WebRequest `
        -Uri $NODE_URL `
        -OutFile $NODE_INSTALLER

    Success "Node.js downloaded"

    Info "Installing Node.js silently..."

    Start-Process `
        msiexec.exe `
        -Wait `
        -ArgumentList @(
            "/i",
            "`"$NODE_INSTALLER`"",
            "/quiet",
            "/norestart"
        )

    Success "Node.js installed"
}

Success "Node.js ready"

# ============================================================
# MYSQL INSTALL
# ============================================================

Info "Checking MySQL..."

$MYSQL_EXISTS = Get-Command mysql -ErrorAction SilentlyContinue

if (!$MYSQL_EXISTS) {

    Info "MySQL not found"

    $MYSQL_URL = "https://dev.mysql.com/get/Downloads/MySQLInstaller/mysql-installer-community-8.0.42.0.msi"

    $MYSQL_INSTALLER = "$ROOT\mysql-installer-community.msi"

    Info "Downloading MySQL..."

    Invoke-WebRequest `
        -Uri $MYSQL_URL `
        -OutFile $MYSQL_INSTALLER

    Success "MySQL downloaded"

    Info "Installing MySQL silently..."

    Start-Process `
        msiexec.exe `
        -Wait `
        -ArgumentList @(
            "/i",
            "`"$MYSQL_INSTALLER`"",
            "/quiet",
            "/norestart"
        )

    Success "MySQL installed"
}

Success "MySQL ready"

# ============================================================
# REFRESH ENV
# ============================================================

$env:Path = [System.Environment]::GetEnvironmentVariable(
    "Path",
    "Machine"
) + ";" + `
[System.Environment]::GetEnvironmentVariable(
    "Path",
    "User"
)

# ============================================================
# MYSQL DATABASE SETUP
# ============================================================

Info "Configuring MySQL database..."

try {

    mysql -u root -e "CREATE DATABASE IF NOT EXISTS boxify;"

    Success "Database configured"
}
catch {

    ErrorMsg "Could not auto-configure MySQL database"
}

# ============================================================
# BACKEND
# ============================================================

Info "Setting up backend..."

if (!(Test-Path "$BACKEND\venv")) {

    python -m venv "$BACKEND\venv"
}

# ============================================================
# ACTIVATE VENV
# ============================================================

& "$BACKEND\venv\Scripts\Activate.ps1"

# ============================================================
# INSTALL PYTHON PACKAGES
# ============================================================

Info "Installing backend dependencies..."

python -m pip install --upgrade pip

pip install -r "$BACKEND\requirements.txt"

Success "Backend ready"

# ============================================================
# FRONTEND
# ============================================================

Info "Installing frontend..."

Set-Location $FRONTEND

npm install

Info "Building frontend..."

npm run build

Set-Location $ROOT

Success "Frontend ready"

# ============================================================
# FIREWALL
# ============================================================

Info "Creating firewall rules..."

try {

    New-NetFirewallRule `
        -DisplayName "Boxify Backend 8000" `
        -Direction Inbound `
        -Protocol TCP `
        -LocalPort 8000 `
        -Action Allow `
        -ErrorAction SilentlyContinue

    New-NetFirewallRule `
        -DisplayName "Boxify Frontend 3001" `
        -Direction Inbound `
        -Protocol TCP `
        -LocalPort 3001 `
        -Action Allow `
        -ErrorAction SilentlyContinue

    Success "Firewall rules created"
}
catch {

    ErrorMsg "Firewall rule creation failed"
}

# ============================================================
# GENERATE START SCRIPT
# ============================================================

Info "Generating launcher scripts..."

$START_BAT = @"
@echo off

cd /d "$ROOT"

echo Starting Backend...

powershell -WindowStyle Hidden -Command ^
"`$p = Start-Process python ^
-ArgumentList '-m uvicorn api.main:app --host 0.0.0.0 --port 8000' ^
-WorkingDirectory '$BACKEND' ^
-PassThru; ^
`$p.Id ^| Out-File '$ROOT\backend.pid'"

timeout /t 5 >nul

echo Starting Frontend...

powershell -WindowStyle Hidden -Command ^
"`$p = Start-Process npm ^
-ArgumentList 'run start' ^
-WorkingDirectory '$FRONTEND' ^
-PassThru; ^
`$p.Id ^| Out-File '$ROOT\frontend.pid'"

timeout /t 5 >nul

start http://localhost:3001
"@

Set-Content "$ROOT\Start Boxify.bat" $START_BAT

# ============================================================
# GENERATE STOP SCRIPT
# ============================================================

$STOP_BAT = @"
@echo off

echo Stopping Boxify...

if exist "$ROOT\backend.pid" (
    set /p BPID=<"$ROOT\backend.pid"
    taskkill /F /PID %BPID%
    del "$ROOT\backend.pid"
)

if exist "$ROOT\frontend.pid" (
    set /p FPID=<"$ROOT\frontend.pid"
    taskkill /F /PID %FPID%
    del "$ROOT\frontend.pid"
)

echo Boxify stopped.
pause
"@

Set-Content "$ROOT\Stop Boxify.bat" $STOP_BAT

# ============================================================
# GENERATE UNINSTALL SCRIPT
# ============================================================

$UNINSTALL_BAT = @"
@echo off

echo Removing Boxify...

call "$ROOT\Stop Boxify.bat"

rmdir /S /Q "$BACKEND\venv"
rmdir /S /Q "$FRONTEND\node_modules"

del "%USERPROFILE%\Desktop\Boxify.lnk"

echo Boxify removed.
pause
"@

Set-Content "$ROOT\Uninstall Boxify.bat" $UNINSTALL_BAT

# ============================================================
# DESKTOP SHORTCUT
# ============================================================

Info "Creating desktop shortcut..."

$DESKTOP = [Environment]::GetFolderPath("Desktop")

$WshShell = New-Object -ComObject WScript.Shell

$Shortcut = $WshShell.CreateShortcut(
    "$DESKTOP\Boxify.lnk"
)

$Shortcut.TargetPath = "$ROOT\Start Boxify.bat"

if (Test-Path "$ASSETS\boxify.ico") {

    $Shortcut.IconLocation = "$ASSETS\boxify.ico"
}

$Shortcut.Save()

Success "Desktop shortcut created"

# ============================================================
# START APP
# ============================================================

Info "Starting Boxify..."

Start-Process "$ROOT\Start Boxify.bat"

# ============================================================
# SHOW URL INFO
# ============================================================

$LOCAL_IP = (
    Get-NetIPAddress `
    -AddressFamily IPv4 |
    Where-Object {
        $_.IPAddress -notlike "127.*" -and
        $_.IPAddress -notlike "169.254*"
    } |
    Select-Object -First 1
).IPAddress

# ============================================================
# DONE
# ============================================================

Write-Host ""
Write-Host "==================================================" -ForegroundColor Green
Write-Host "             INSTALLATION COMPLETE                " -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Write-Host ""

Write-Host "Visit Boxify Dashboard Here:" -ForegroundColor Green

Write-Host "http://localhost:3001" -ForegroundColor Cyan

if ($LOCAL_IP) {

    Write-Host "http://$LOCAL_IP`:3001" -ForegroundColor Cyan
}

Write-Host ""

Write-Host "Management Scripts:" -ForegroundColor Yellow

Write-Host "$ROOT\Start Boxify.bat" -ForegroundColor Cyan
Write-Host "$ROOT\Stop Boxify.bat" -ForegroundColor Cyan
Write-Host "$ROOT\Uninstall Boxify.bat" -ForegroundColor Cyan

Write-Host ""

Write-Host "Desktop Shortcut:" -ForegroundColor Yellow
Write-Host "$DESKTOP\Boxify.lnk" -ForegroundColor Cyan

Write-Host ""

Success "Python installed"
Success "Node.js installed"
Success "MySQL installed"
Success "Backend configured"
Success "Frontend configured"
Success "Desktop shortcut created"

[System.Windows.Forms.MessageBox]::Show(
    "Boxify installed successfully.",
    "Boxify Installer"
)