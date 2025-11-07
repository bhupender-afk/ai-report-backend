#!/bin/bash

# Deployment script for AI Report Backend
# This script helps deploy changes from local/GitHub to the server

set -e

SERVER_HOST="31.97.235.250"
SERVER_USER="root"
SERVER_PASSWORD="Kd@WWKkR7ub#hv"
DEPLOY_PATH="/var/www/zuvomo_launchpad/ai-report-backend"
PM2_APP_NAME="ai-report-backend"

echo "🚀 Starting deployment to $SERVER_HOST..."

# Function to run SSH commands
run_ssh() {
    sshpass -p "$SERVER_PASSWORD" ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_HOST" "$1"
}

# Function to sync files
sync_files() {
    echo "📂 Syncing files to server..."
    rsync -avz --delete -e "sshpass -p '$SERVER_PASSWORD' ssh -o StrictHostKeyChecking=no" \
        --exclude='node_modules' \
        --exclude='.git' \
        --exclude='.env' \
        --exclude='logs' \
        --exclude='test_*.js' \
        --exclude='uploads/*' \
        ./ "$SERVER_USER@$SERVER_HOST:$DEPLOY_PATH/"
}

# Main deployment process
echo "1. Syncing files..."
sync_files

echo "2. Installing dependencies..."
run_ssh "cd $DEPLOY_PATH && npm install --production"

echo "3. Restarting PM2 application..."
run_ssh "cd $DEPLOY_PATH && pm2 restart $PM2_APP_NAME || (PORT=8080 pm2 start server-enhanced.js --name $PM2_APP_NAME && pm2 save)"

echo "4. Checking application status..."
sleep 3
run_ssh "curl -s localhost:8080/api/health || echo 'Health check failed'"

echo "✅ Deployment completed successfully!"
echo "🌐 API is available at: http://$SERVER_HOST:8080/api/health"