#!/usr/bin/env bash
set -e

echo "== Installing Docker Engine =="
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo usermod -aG docker "$USER"
sudo systemctl enable --now docker

echo "== Installing Node.js 22 (nvm) =="
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install 22
nvm alias default 22

echo "== Installing Compact compiler =="
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh
source ~/.bashrc || true
export PATH="$HOME/.local/bin:$PATH"
command -v compact >/dev/null 2>&1 && compact update || echo "Run 'source ~/.bashrc' then 'compact update' manually if this failed."

echo ""
echo "== Versions =="
docker --version || echo "docker: not yet on PATH in this shell — close and reopen your WSL terminal"
node --version
npm --version
compact --version || echo "compact: run 'source ~/.bashrc' in a new terminal"

echo ""
echo "Done. Close this WSL terminal and open a NEW one (needed for the docker group + PATH changes to apply), then let Claude know."
