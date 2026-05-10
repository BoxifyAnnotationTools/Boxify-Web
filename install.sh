#!/bin/bash
set -e

# =========================================================
# Boxify-Web Auto Installer
# =========================================================

# ---------- UI ----------
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
NC='\033[0m'

clear

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

BOXIFY_DB_NAME="boxify"

# ✅ FIX 1: Define and create SCRIPT_DIR early, before any script generation
SCRIPT_DIR="${ROOT_DIR}/bashScripts"
mkdir -p "${SCRIPT_DIR}"

echo -e "${CYAN}${BOLD}"
echo "========================================="
echo "        Boxify-Web Installer             "
echo "========================================="
echo -e "${NC}"

# =========================================================
# 1. MYSQL ROOT DETECTION
# =========================================================

echo -e "${BLUE}[1/7] Detecting MySQL access...${NC}"

MYSQL_CMD=""
MYSQL_ROOT_USER="root"
MYSQL_ROOT_PASSWORD=""

if sudo mysql -e "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ MySQL accessible via sudo mysql${NC}"
    MYSQL_CMD="sudo mysql"

elif mysql -uroot -e "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ MySQL root accessible without password${NC}"
    MYSQL_CMD="mysql -uroot"

else
    echo -e "${YELLOW}MySQL requires authentication.${NC}"

    read -p "MySQL ROOT username [root]: " MYSQL_ROOT_USER
    MYSQL_ROOT_USER=${MYSQL_ROOT_USER:-root}

    read -p "MySQL ROOT password: " MYSQL_ROOT_PASSWORD
    echo

    if mysql -u"$MYSQL_ROOT_USER" -p"$MYSQL_ROOT_PASSWORD" -e "SELECT 1;" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ MySQL authentication successful${NC}"
        MYSQL_CMD="mysql -u$MYSQL_ROOT_USER -p$MYSQL_ROOT_PASSWORD"
    else
        echo -e "${RED}❌ Failed to authenticate MySQL.${NC}"
        exit 1
    fi
fi

# =========================================================
# 2. DATABASE CONFIG
# =========================================================

echo -e "\n${BLUE}[2/7] Boxify Database Configuration${NC}"

read -p "Boxify DB username [boxify_user]: " BOXIFY_DB_USER
BOXIFY_DB_USER=${BOXIFY_DB_USER:-boxify_user}

read -p "Boxify DB password [boxify123]: " BOXIFY_DB_PASSWORD
echo

if [ -z "$BOXIFY_DB_PASSWORD" ]; then
    BOXIFY_DB_PASSWORD="boxify123"
fi

# =========================================================
# 3. VALIDATE DEPENDENCIES
# =========================================================

echo -e "\n${BLUE}[3/7] Validating dependencies...${NC}"

if ! command -v python3.10 &> /dev/null; then
    echo -e "${RED}[ERROR] Python 3.10 not found.${NC}"
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo -e "${RED}[ERROR] Node.js not found.${NC}"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo -e "${RED}[ERROR] npm not found.${NC}"
    exit 1
fi

if ! command -v mysql &> /dev/null; then
    echo -e "${RED}[ERROR] mysql client not found.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Dependencies OK${NC}"

# =========================================================
# 4. MYSQL DATABASE SETUP
# =========================================================

echo -e "\n${BLUE}[4/7] Creating database + user...${NC}"

$MYSQL_CMD <<MYSQL_SCRIPT

CREATE DATABASE IF NOT EXISTS ${BOXIFY_DB_NAME}
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS '${BOXIFY_DB_USER}'@'localhost'
IDENTIFIED BY '${BOXIFY_DB_PASSWORD}';

ALTER USER '${BOXIFY_DB_USER}'@'localhost'
IDENTIFIED BY '${BOXIFY_DB_PASSWORD}';

GRANT ALL PRIVILEGES ON ${BOXIFY_DB_NAME}.* TO '${BOXIFY_DB_USER}'@'localhost';

FLUSH PRIVILEGES;

MYSQL_SCRIPT

echo -e "${GREEN}✅ Database configured.${NC}"

# =========================================================
# 5. UPDATE BACKEND CONFIG
# =========================================================

echo -e "\n${BLUE}[5/7] Updating backend config...${NC}"

CONFIG_FILE="$BACKEND_DIR/core/config.py"

NEW_DB_URL="mysql+pymysql://${BOXIFY_DB_USER}:${BOXIFY_DB_PASSWORD}@localhost:3306/${BOXIFY_DB_NAME}"

python3 <<EOF
from pathlib import Path
import re

config_file = Path("$CONFIG_FILE")

text = config_file.read_text()

text = re.sub(
    r'mysql\\+pymysql://.*?boxify',
    '$NEW_DB_URL',
    text
)

config_file.write_text(text)

print("config.py updated.")
EOF

echo -e "${GREEN}✅ backend/core/config.py updated.${NC}"

# =========================================================
# 6. INSTALL BACKEND + FRONTEND
# =========================================================

echo -e "\n${BLUE}[6/7] Installing backend + frontend...${NC}"

# ---------- BACKEND ----------
cd "$BACKEND_DIR"

if [ ! -d "venv" ]; then
    echo -e "${CYAN}Creating Python virtual environment...${NC}"
    python3.10 -m venv venv
fi

source venv/bin/activate

pip install --upgrade pip
pip install -r requirements.txt

deactivate

cd "$ROOT_DIR"

# ---------- FRONTEND ----------
cd "$FRONTEND_DIR"

npm install

echo -e "${CYAN}Building frontend...${NC}"
npm run build

cd "$ROOT_DIR"

echo -e "${GREEN}✅ Installation complete.${NC}"

# =========================================================
# 7. CREATE SYSTEMD SERVICES
# =========================================================

echo -e "\n${BLUE}[7/7] Creating systemd services...${NC}"

CURRENT_USER=$(whoami)

# ---------- BACKEND ----------
sudo tee /etc/systemd/system/boxify-backend.service > /dev/null <<EOF
[Unit]
Description=Boxify Backend FastAPI
After=network.target

[Service]
Type=simple
User=${CURRENT_USER}
WorkingDirectory=${BACKEND_DIR}
ExecStart=${BACKEND_DIR}/venv/bin/uvicorn api.main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

# ---------- FRONTEND ----------
sudo tee /etc/systemd/system/boxify-frontend.service > /dev/null <<EOF
[Unit]
Description=Boxify Frontend Next.js
After=network.target

[Service]
Type=simple
User=${CURRENT_USER}
WorkingDirectory=${FRONTEND_DIR}
ExecStart=/usr/bin/npm run start -- -H 0.0.0.0 -p 3001
Restart=always
RestartSec=3
Environment=NODE_ENV=production
Environment=PORT=3001
Environment=HOSTNAME=0.0.0.0

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload

echo -e "${GREEN}✅ Services created.${NC}"

# =========================================================
# AUTO-START SERVICES
# =========================================================

echo -e "\n${BLUE}Starting Boxify services...${NC}"

for SERVICE in boxify-backend boxify-frontend; do
    sudo systemctl enable $SERVICE > /dev/null 2>&1
    sudo systemctl restart $SERVICE
    echo -e "${GREEN}✅ ${SERVICE} started${NC}"
done

# =========================================================
# FIREWALL CONFIGURATION
# =========================================================

echo -e "\n${BLUE}Configuring firewall rules...${NC}"

OPEN_PORTS=("3001/tcp" "8000/tcp")

# ---------------------------------------------------------
# UFW (Ubuntu/Debian)
# ---------------------------------------------------------

if command -v ufw &> /dev/null; then

    echo -e "${CYAN}Detected UFW firewall.${NC}"

    for PORT in "${OPEN_PORTS[@]}"
    do
        sudo ufw allow $PORT > /dev/null 2>&1 || true
        echo -e "${GREEN}✅ Allowed port ${PORT} via UFW${NC}"
    done

    # enable ufw safely if inactive
    UFW_STATUS=$(sudo ufw status | head -n 1)

    if [[ "$UFW_STATUS" == *inactive* ]]; then

        echo -e "${YELLOW}UFW is inactive.${NC}"
        echo -e "${CYAN}Enabling UFW firewall safely...${NC}"

        sudo ufw allow ssh > /dev/null 2>&1 || true
        sudo ufw --force enable > /dev/null 2>&1 || true

        echo -e "${GREEN}✅ UFW enabled${NC}"

    fi

# ---------------------------------------------------------
# FIREWALLD (CentOS/RHEL/Fedora)
# ---------------------------------------------------------

elif command -v firewall-cmd &> /dev/null; then

    echo -e "${CYAN}Detected firewalld.${NC}"

    sudo systemctl enable firewalld > /dev/null 2>&1 || true
    sudo systemctl start firewalld > /dev/null 2>&1 || true

    for PORT in "${OPEN_PORTS[@]}"
    do
        sudo firewall-cmd --permanent --add-port=$PORT > /dev/null 2>&1 || true
        echo -e "${GREEN}✅ Allowed port ${PORT} via firewalld${NC}"
    done

    sudo firewall-cmd --reload > /dev/null 2>&1 || true

    echo -e "${GREEN}✅ firewalld reloaded${NC}"

# ---------------------------------------------------------
# IPTABLES ONLY
# ---------------------------------------------------------

elif command -v iptables &> /dev/null; then

    echo -e "${CYAN}Detected iptables.${NC}"

    for PORT in 3001 8000
    do
        sudo iptables -C INPUT -p tcp --dport $PORT -j ACCEPT 2>/dev/null || \
        sudo iptables -A INPUT -p tcp --dport $PORT -j ACCEPT

        echo -e "${GREEN}✅ Allowed TCP port ${PORT} via iptables${NC}"
    done

# ---------------------------------------------------------
# NO FIREWALL
# ---------------------------------------------------------

else

    echo -e "${YELLOW}⚠️  No supported firewall detected.${NC}"
    echo -e "${YELLOW}Skipping firewall configuration.${NC}"

fi

echo -e "${GREEN}✅ Firewall configuration completed.${NC}"

# =========================================================
# GENERATE MANAGEMENT SCRIPTS
# =========================================================

echo -e "\n${BLUE}Generating management scripts...${NC}"

# =========================================================
# START SCRIPT
# =========================================================

cat > "$SCRIPT_DIR/start-boxify.sh" <<'HEREDOC'
#!/bin/bash

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

clear

echo -e "${CYAN}${BOLD}"
echo "=========================================="
echo "         🚀 START BOXIFY SERVICES         "
echo "=========================================="
echo -e "${NC}"

SERVICES=("boxify-backend" "boxify-frontend")

for SERVICE in "${SERVICES[@]}"
do
    echo -e "${YELLOW}Checking ${SERVICE}...${NC}"

    if systemctl list-unit-files | grep -q "${SERVICE}.service"; then

        echo -e "${GREEN}✅ Service exists${NC}"

        sudo systemctl enable $SERVICE > /dev/null 2>&1
        echo -e "${GREEN}✅ Auto start enabled${NC}"

        sudo systemctl restart $SERVICE

        echo -e "${GREEN}✅ ${SERVICE} started successfully${NC}"

    else

        echo -e "${RED}❌ ${SERVICE} not found${NC}"

    fi

    echo ""
done

echo -e "${CYAN}${BOLD}"
echo "=========================================="
echo "       🎉 ALL SERVICES ARE RUNNING        "
echo "=========================================="
echo -e "${NC}"
HEREDOC

chmod +x "$SCRIPT_DIR/start-boxify.sh"

# =========================================================
# STOP SERVICES SCRIPT
# =========================================================

# ✅ FIX 2: was incorrectly writing to $ROOT_DIR, now consistent with $SCRIPT_DIR
cat > "$SCRIPT_DIR/stop-boxify.sh" <<'HEREDOC'
#!/bin/bash

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

clear

echo -e "${RED}${BOLD}"
echo "=========================================="
echo "          🛑 STOP BOXIFY SERVICES         "
echo "=========================================="
echo -e "${NC}"

SERVICES=("boxify-backend" "boxify-frontend")

for SERVICE in "${SERVICES[@]}"
do
    echo -e "${YELLOW}Checking ${SERVICE}...${NC}"

    if systemctl list-unit-files | grep -q "${SERVICE}.service"; then
        echo -e "${GREEN}✅ Service exists${NC}"

        sudo systemctl disable $SERVICE > /dev/null 2>&1
        echo -e "${GREEN}✅ Auto start disabled${NC}"

        sudo systemctl stop $SERVICE

        echo -e "${GREEN}✅ ${SERVICE} stopped successfully${NC}"
    else
        echo -e "${RED}❌ ${SERVICE} not found${NC}"
    fi

    echo ""
done

echo -e "${RED}${BOLD}"
echo "=========================================="
echo "         💤 ALL SERVICES STOPPED          "
echo "=========================================="
echo -e "${NC}"
HEREDOC

chmod +x "$SCRIPT_DIR/stop-boxify.sh"

# =========================================================
# MONITOR SCRIPT
# =========================================================

cat > "$SCRIPT_DIR/monitor-boxify.sh" <<'HEREDOC'
#!/bin/bash

GREEN='\033[0;32m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
NC='\033[0m'

clear

echo -e "${CYAN}${BOLD}"
echo "=========================================="
echo "        📡 BOXIFY LIVE MONITORING         "
echo "=========================================="
echo -e "${NC}"

if ! command -v gnome-terminal &> /dev/null; then

    echo ""
    echo -e "${MAGENTA}GUI terminal not found.${NC}"
    echo -e "${CYAN}Falling back to CLI monitoring mode...${NC}"
    echo ""

    echo "Backend logs:"
    echo "journalctl -u boxify-backend -f"
    echo ""
    echo "Frontend logs:"
    echo "journalctl -u boxify-frontend -f"
    echo ""

    exit 0
fi

echo -e "${GREEN}Opening backend logs...${NC}"

gnome-terminal -- bash -c "
echo -e '=== BACKEND LOGS ===';
journalctl -u boxify-backend -f;
exec bash
"

sleep 1

echo -e "${GREEN}Opening frontend logs...${NC}"

gnome-terminal -- bash -c "
echo -e '=== FRONTEND LOGS ===';
journalctl -u boxify-frontend -f;
exec bash
"

echo ""
echo -e "${GREEN}${BOLD}✅ Monitoring started.${NC}"
HEREDOC

chmod +x "$SCRIPT_DIR/monitor-boxify.sh"

# =========================================================
# UNINSTALL SCRIPT
# ✅ FIX 3: heredoc was broken — unclosed, chmod was inside it,
#    and MySQL heredoc inside was not escaped. Fixed by using
#    a properly closed heredoc with escaped inner delimiter.
# =========================================================

cat > "$SCRIPT_DIR/uninstall-boxify.sh" <<HEREDOC
#!/bin/bash

set -e

ROOT_DIR="\$(cd "\$(dirname "\$0")/.." && pwd)"

BOXIFY_DB_NAME="boxify"
BOXIFY_DB_USER="${BOXIFY_DB_USER}"

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
NC='\033[0m'

clear

echo -e "\${RED}\${BOLD}"
echo "========================================================"
echo "                ⚠️  WARNING - BOXIFY                   "
echo "========================================================"
echo -e "\${NC}"

echo -e "\${YELLOW}\${BOLD}"
echo "You are about to COMPLETELY REMOVE Boxify from this system."
echo ""
echo "The following data WILL BE PERMANENTLY DELETED:"
echo ""
echo "  • All uploaded images"
echo "  • All annotations"
echo "  • All projects"
echo "  • All database records"
echo "  • All application services"
echo ""
echo "THIS ACTION CANNOT BE UNDONE."
echo "THIS DATA CANNOT BE RECOVERED."
echo ""
echo "Please make sure you have created a backup before continuing."
echo -e "\${NC}"

echo -e "\${RED}\${BOLD}"
echo "========================================================"
echo -e "\${NC}"

read -p "Type DELETE to continue: " CONFIRM

if [ "\$CONFIRM" != "DELETE" ]; then
    echo ""
    echo -e "\${CYAN}Uninstall cancelled safely.\${NC}"
    exit 0
fi

echo ""
echo -e "\${CYAN}\${BOLD}Removing services...\${NC}"

SERVICES=("boxify-backend" "boxify-frontend")

for SERVICE in "\${SERVICES[@]}"
do
    sudo systemctl stop \$SERVICE || true
    sudo systemctl disable \$SERVICE || true
    sudo rm -f /etc/systemd/system/\${SERVICE}.service
    echo -e "\${GREEN}✅ \${SERVICE} removed\${NC}"
done

sudo systemctl daemon-reload

echo ""
echo -e "\${CYAN}\${BOLD}Removing database...\${NC}"

if sudo mysql -e "SELECT 1;" > /dev/null 2>&1; then
    sudo mysql <<MYSQL_EOF
DROP DATABASE IF EXISTS \${BOXIFY_DB_NAME};
DROP USER IF EXISTS '\${BOXIFY_DB_USER}'@'localhost';
FLUSH PRIVILEGES;
MYSQL_EOF
    echo -e "\${GREEN}✅ Database removed.\${NC}"
else
    echo -e "\${YELLOW}⚠️  Could not connect to MySQL. Skipping database removal.\${NC}"
fi

echo ""
echo -e "\${GREEN}\${BOLD}✅ Boxify has been completely removed.\${NC}"
HEREDOC

chmod +x "$SCRIPT_DIR/uninstall-boxify.sh"

# =========================================================
# GENERATE DESKTOP LAUNCHERS
# =========================================================

echo -e "\n${BLUE}Generating desktop launchers...${NC}"

LAUNCHER_DIR="$SCRIPT_DIR"

# =========================================================
# DETECT TERMINAL EMULATOR
# =========================================================

TERMINAL_CMD=""

if command -v x-terminal-emulator &> /dev/null; then
    TERMINAL_CMD="x-terminal-emulator -e"
elif command -v gnome-terminal &> /dev/null; then
    TERMINAL_CMD="gnome-terminal --"
elif command -v konsole &> /dev/null; then
    TERMINAL_CMD="konsole -e"
elif command -v xfce4-terminal &> /dev/null; then
    TERMINAL_CMD="xfce4-terminal -e"
else
    echo -e "${YELLOW}No GUI terminal detected.${NC}"
    echo -e "${YELLOW}Desktop launchers may not work in headless environments.${NC}"
fi

# =========================================================
# START LAUNCHER
# =========================================================

cat > "$LAUNCHER_DIR/Start Boxify.desktop" <<EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=Start Boxify
Comment=Start Boxify Services
Exec=${TERMINAL_CMD} bash -c '${SCRIPT_DIR}/start-boxify.sh; exec bash'
Icon=utilities-terminal
Terminal=false
Categories=Utility;
EOF

# =========================================================
# STOP LAUNCHER
# =========================================================

cat > "$LAUNCHER_DIR/Stop Boxify.desktop" <<EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=Stop Boxify
Comment=Stop Boxify Services
Exec=${TERMINAL_CMD} bash -c '${SCRIPT_DIR}/stop-boxify.sh; exec bash'
Icon=utilities-terminal
Terminal=false
Categories=Utility;
EOF

# =========================================================
# MONITOR LAUNCHER
# =========================================================

cat > "$LAUNCHER_DIR/Monitor Boxify.desktop" <<EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=Monitor Boxify
Comment=Monitor Boxify Logs
Exec=${TERMINAL_CMD} bash -c '${SCRIPT_DIR}/monitor-boxify.sh; exec bash'
Icon=utilities-terminal
Terminal=false
Categories=Utility;
EOF

# =========================================================
# UNINSTALL LAUNCHER
# =========================================================

cat > "$LAUNCHER_DIR/Uninstall Boxify.desktop" <<EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=Uninstall Boxify
Comment=Remove Boxify
Exec=${TERMINAL_CMD} bash -c '${SCRIPT_DIR}/uninstall-boxify.sh; exec bash'
Icon=utilities-terminal
Terminal=false
Categories=Utility;
EOF

# =========================================================
# PERMISSIONS
# =========================================================

chmod +x "$LAUNCHER_DIR/Start Boxify.desktop"
chmod +x "$LAUNCHER_DIR/Stop Boxify.desktop"
chmod +x "$LAUNCHER_DIR/Monitor Boxify.desktop"
chmod +x "$LAUNCHER_DIR/Uninstall Boxify.desktop"

# =========================================================
# TRUST DESKTOP FILES (GNOME)
# =========================================================

if command -v gio &> /dev/null; then
    gio set "$LAUNCHER_DIR/Start Boxify.desktop" metadata::trusted true || true
    gio set "$LAUNCHER_DIR/Stop Boxify.desktop" metadata::trusted true || true
    gio set "$LAUNCHER_DIR/Monitor Boxify.desktop" metadata::trusted true || true
    gio set "$LAUNCHER_DIR/Uninstall Boxify.desktop" metadata::trusted true || true
fi

# =========================================================
# UPDATE DESKTOP DATABASE
# =========================================================

if command -v update-desktop-database &> /dev/null; then
    update-desktop-database "$LAUNCHER_DIR" > /dev/null 2>&1 || true
fi

echo -e "${GREEN}✅ Desktop launchers generated.${NC}"

# =========================================================
# DONE
# =========================================================

echo -e "\n${CYAN}${BOLD}"
echo "========================================================"
echo "         🎉 INSTALLATION SUCCESSFUL 🚀                  "
echo "========================================================"
echo -e "${NC}"

echo ""
echo -e "${GREEN}Backend  : http://localhost:8000${NC}"

echo ""
echo -e "${GREEN}Visit Boxify Dashboard Here:${NC}"
echo -e "${CYAN}http://localhost:3001${NC}"
echo -e "${CYAN}http://$(hostname -I | awk '{print $1}'):3001${NC}"

echo ""
echo -e "${YELLOW}Management Scripts:${NC}"
echo -e "${CYAN}$SCRIPT_DIR/start-boxify.sh${NC}"
echo -e "${CYAN}$SCRIPT_DIR/stop-boxify.sh${NC}"
echo -e "${CYAN}$SCRIPT_DIR/monitor-boxify.sh${NC}"
echo -e "${CYAN}$SCRIPT_DIR/uninstall-boxify.sh${NC}"

echo ""
echo -e "${YELLOW}Desktop Launchers:${NC}"
echo -e "${CYAN}$LAUNCHER_DIR/Start Boxify.desktop${NC}"
echo -e "${CYAN}$LAUNCHER_DIR/Stop Boxify.desktop${NC}"
echo -e "${CYAN}$LAUNCHER_DIR/Monitor Boxify.desktop${NC}"
echo -e "${CYAN}$LAUNCHER_DIR/Uninstall Boxify.desktop${NC}"

echo ""
echo -e "${GREEN}You can now manage Boxify using:${NC}"
echo -e "${GREEN}• Shell scripts (.sh)${NC}"
echo -e "${GREEN}• Desktop launchers (.desktop)${NC}"

echo ""