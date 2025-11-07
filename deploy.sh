#!/bin/bash

# Deployment script for AI Report Backend
# This script helps deploy changes from local/GitHub to the server

set -e

# Load deployment configuration
if [ -f ".env.deploy" ]; then
    export $(cat .env.deploy | grep -v '^#' | xargs)
else
    echo "⚠️  .env.deploy file not found. Using default values..."
fi

# Default configuration (override with .env.deploy)
SERVER_HOST="${SERVER_HOST:-31.97.235.250}"
SERVER_USER="${SERVER_USER:-root}"
SERVER_PASSWORD="${SERVER_PASSWORD:-Kd@WWKkR7ub#hv}"
DEPLOY_PATH="${DEPLOY_PATH:-/var/www/zuvomo_launchpad/ai-report-backend}"
PM2_APP_NAME="${PM2_APP_NAME:-ai-report-backend}"
GITHUB_REPO="${GITHUB_REPO:-https://github.com/bhupender-afk/ai-report-backend.git}"

echo "🚀 Starting deployment to $SERVER_HOST..."

# Function to run SSH commands
run_ssh() {
    sshpass -p "$SERVER_PASSWORD" ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_HOST" "$1"
}

# Function to sync files via Git
sync_via_git() {
    echo "📂 Syncing via GitHub..."

    # Push local changes to GitHub first
    echo "  → Pushing local changes to GitHub..."
    git add . && git commit -m "Deployment update $(date '+%Y-%m-%d %H:%M:%S')" || echo "No changes to commit"
    git push origin main

    # Pull changes on server
    echo "  → Pulling changes on server..."
    run_ssh "cd $DEPLOY_PATH && git pull origin main || echo 'Already up to date'"
}

# Function to sync files directly (fallback)
sync_files() {
    echo "📂 Syncing files directly to server..."
    rsync -avz --delete -e "sshpass -p '$SERVER_PASSWORD' ssh -o StrictHostKeyChecking=no" \
        --exclude='node_modules' \
        --exclude='.git' \
        --exclude='.env' \
        --exclude='logs' \
        --exclude='test_*.js' \
        --exclude='uploads/*' \
        ./ "$SERVER_USER@$SERVER_HOST:$DEPLOY_PATH/"
}

# Choose sync method
echo "Choose deployment method:"
echo "1. Git sync (recommended)"
echo "2. Direct file sync"
read -p "Enter choice (1 or 2): " sync_choice

case $sync_choice in
    1)
        echo "1. Syncing via Git..."
        sync_via_git
        ;;
    2)
        echo "1. Syncing files directly..."
        sync_files
        ;;
    *)
        echo "Using default Git sync..."
        sync_via_git
        ;;
esac

echo "2. Installing dependencies..."
run_ssh "cd $DEPLOY_PATH && npm install --production"

echo "3. Restarting PM2 application..."
run_ssh "cd $DEPLOY_PATH && pm2 restart $PM2_APP_NAME || (PORT=8080 pm2 start server-enhanced.js --name $PM2_APP_NAME && pm2 save)"

echo "4. Checking application status..."
sleep 3
run_ssh "curl -s localhost:8080/api/health || echo 'Health check failed'"

echo "✅ Deployment completed successfully!"
echo "🌐 API is available at: http://$SERVER_HOST:8080/api/health"
echo "📚 GitHub Repository: https://github.com/bhupender-afk/ai-report-backend"