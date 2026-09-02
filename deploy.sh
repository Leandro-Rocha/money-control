#!/bin/bash
set -e

# ==========================================
# CONFIGURAÇÕES DE DEPLOY
# ==========================================
if [ -f .env.deploy ]; then
  export $(grep -v '^#' .env.deploy | xargs)
else
  echo "❌ Arquivo .env.deploy não encontrado!"
  exit 1
fi

SERVER_USER="$DEPLOY_USER"
SERVER_IP="$DEPLOY_IP"
SERVER_DIR="/home/leandro/dev/money-control"
PM2_APP_NAME="money-control"
SERVER_PORT=42900

echo "🚀 Iniciando deploy para $SERVER_USER@$SERVER_IP..."
echo "📁 Preparando diretórios no servidor..."
ssh "$SERVER_USER@$SERVER_IP" "mkdir -p $SERVER_DIR/data"

# 1. Enviar o banco de dados APENAS se ele não existir no servidor (Primeiro Deploy)
echo "📂 Verificando banco de dados..."
rsync -avz --ignore-existing \
  data/ "$SERVER_USER@$SERVER_IP:$SERVER_DIR/data/"

# 2. Transferir arquivos de código da aplicação usando rsync
# Ignoramos a pasta data/ completamente para que o rsync --delete não apague o banco de dados do servidor
echo "📦 Sincronizando código fonte com o servidor..."
rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude '.git' \
  --exclude 'data' \
  --exclude '.env' \
  --exclude '.env.local' \
  --exclude 'deploy.sh' \
  --exclude '*.py' \
  --exclude 'openspec' \
  --exclude '.agents' \
  --exclude 'mockups' \
  --exclude 'AGENTS.md' \
  --exclude 'README.md' \
  --exclude 'tsconfig.tsbuildinfo' \
  --exclude 'seed-*.mjs' \
  ./ "$SERVER_USER@$SERVER_IP:$SERVER_DIR/"

# 3. Conectar via SSH e executar comandos de build e restart
# É importante compilar no servidor pois módulos nativos como o 'better-sqlite3' 
# precisam ser compilados na mesma arquitetura do sistema operacional final (Linux).
echo "🔧 Compilando e reiniciando no servidor..."
ssh "$SERVER_USER@$SERVER_IP" << EOF
  set -e
  
  # Força o carregamento do ambiente do usuário
  source ~/.bash_profile 2>/dev/null || true
  source ~/.bashrc 2>/dev/null || true
  source ~/.profile 2>/dev/null || true
  
  # Carrega o NVM explicitamente
  export NVM_DIR="\$HOME/.nvm"
  [ -s "\$NVM_DIR/nvm.sh" ] && source "\$NVM_DIR/nvm.sh"
  
  # Caso use Node via FNM
  export FNM_DIR="\$HOME/.local/share/fnm"
  [ -s "\$FNM_DIR/fnm" ] && eval "\`\$FNM_DIR/fnm env\`"
  
  # Caso use Volta
  export VOLTA_HOME="\$HOME/.volta"
  [ -s "\$VOLTA_HOME/bin/volta" ] && export PATH="\$VOLTA_HOME/bin:\$PATH"
  
  # Caso o npm ainda não esteja no PATH, tenta locais comuns (como /usr/local/bin)
  export PATH="/usr/local/bin:\$PATH"

  cd "$SERVER_DIR"
  
  echo "📥 Instalando dependências..."
  npm install --production=false
  
  echo "🏗️ Fazendo build do Next.js..."
  npm run build
  
  echo "🔄 Reiniciando aplicação na porta $SERVER_PORT..."
  # Tenta reiniciar o app no pm2 injetando a porta. Se falhar, inicia pela primeira vez.
  PORT=$SERVER_PORT pm2 restart $PM2_APP_NAME --update-env || PORT=$SERVER_PORT pm2 start npm --name "$PM2_APP_NAME" -- start
  
  echo "✅ Processo no servidor concluído!"
EOF

echo "🎉 Deploy finalizado com sucesso!"
