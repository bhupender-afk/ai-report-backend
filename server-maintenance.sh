#!/bin/bash

# Server maintenance script for AI Report Backend
# Run this script on the server for common maintenance tasks

set -e

DEPLOY_PATH="/var/www/zuvomo_launchpad/ai-report-backend"
PM2_APP_NAME="ai-report-backend"

cd $DEPLOY_PATH

echo "🔧 AI Report Backend - Server Maintenance"
echo "========================================"

# Function to show menu
show_menu() {
    echo ""
    echo "Select an option:"
    echo "1. Check application status"
    echo "2. View live logs"
    echo "3. Restart application"
    echo "4. Pull latest changes from GitHub"
    echo "5. Update dependencies"
    echo "6. View system resource usage"
    echo "7. Backup database"
    echo "8. Check disk space"
    echo "9. Exit"
    echo ""
}

# Function to check status
check_status() {
    echo "📊 Application Status:"
    pm2 status | grep -E "(ai-report-backend|Process|status)"
    echo ""
    echo "🔗 Testing API endpoint:"
    curl -s localhost:8080/api/health | jq . || echo "API not responding"
}

# Function to view logs
view_logs() {
    echo "📝 Live application logs (Press Ctrl+C to stop):"
    pm2 logs $PM2_APP_NAME
}

# Function to restart app
restart_app() {
    echo "🔄 Restarting application..."
    pm2 restart $PM2_APP_NAME
    sleep 3
    echo "✅ Application restarted"
    check_status
}

# Function to pull from GitHub
pull_updates() {
    echo "🔄 Pulling latest changes from GitHub..."
    if [ -d ".git" ]; then
        git pull origin main
        echo "📦 Updating dependencies..."
        npm install --production
        echo "🔄 Restarting application..."
        pm2 restart $PM2_APP_NAME
        echo "✅ Updates applied successfully"
    else
        echo "❌ Not a Git repository. Please initialize Git first."
    fi
}

# Function to update dependencies
update_deps() {
    echo "📦 Updating dependencies..."
    npm update --production
    pm2 restart $PM2_APP_NAME
    echo "✅ Dependencies updated"
}

# Function to show resource usage
resource_usage() {
    echo "💻 System Resource Usage:"
    echo "------------------------"
    echo "Memory usage:"
    free -h
    echo ""
    echo "CPU usage:"
    top -bn1 | grep "Cpu(s)"
    echo ""
    echo "PM2 processes:"
    pm2 monit --no-interaction || pm2 list
}

# Function to backup database (placeholder)
backup_db() {
    echo "💾 Database backup functionality would go here"
    echo "Please implement database backup according to your MongoDB setup"
}

# Function to check disk space
check_disk() {
    echo "💿 Disk Space Usage:"
    df -h
    echo ""
    echo "📁 Application directory size:"
    du -sh $DEPLOY_PATH
}

# Main menu loop
while true; do
    show_menu
    read -p "Enter your choice (1-9): " choice

    case $choice in
        1)
            check_status
            ;;
        2)
            view_logs
            ;;
        3)
            restart_app
            ;;
        4)
            pull_updates
            ;;
        5)
            update_deps
            ;;
        6)
            resource_usage
            ;;
        7)
            backup_db
            ;;
        8)
            check_disk
            ;;
        9)
            echo "👋 Goodbye!"
            exit 0
            ;;
        *)
            echo "❌ Invalid option. Please try again."
            ;;
    esac
done