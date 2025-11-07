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
    echo "5. Push changes to GitHub"
    echo "6. Show Git status"
    echo "7. Update dependencies"
    echo "8. View system resource usage"
    echo "9. Backup database"
    echo "10. Check disk space"
    echo "11. Exit"
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
        git fetch origin main
        echo "📊 Checking for updates..."
        LOCAL=$(git rev-parse HEAD)
        REMOTE=$(git rev-parse origin/main)

        if [ $LOCAL = $REMOTE ]; then
            echo "✅ Already up to date"
        else
            echo "📥 Pulling new changes..."
            git pull origin main
            echo "📦 Updating dependencies..."
            npm install --production
            echo "🔄 Restarting application..."
            pm2 restart $PM2_APP_NAME
            echo "✅ Updates applied successfully"
        fi
    else
        echo "❌ Not a Git repository. Please initialize Git first."
    fi
}

# Function to push changes to GitHub
push_updates() {
    echo "🚀 Pushing local changes to GitHub..."
    if [ -d ".git" ]; then
        echo "📊 Checking for uncommitted changes..."
        if [ -n "$(git status --porcelain)" ]; then
            echo "📝 Adding and committing changes..."
            git add .
            read -p "Enter commit message: " commit_msg
            git commit -m "${commit_msg:-Server updates $(date '+%Y-%m-%d %H:%M:%S')}"
        fi

        echo "📤 Note: Push requires GitHub token configuration"
        echo "✅ Changes prepared for push (manual setup required)"
    else
        echo "❌ Not a Git repository. Please initialize Git first."
    fi
}

# Function to show Git status
git_status() {
    echo "📊 Git Repository Status:"
    echo "------------------------"
    if [ -d ".git" ]; then
        echo "Branch: $(git branch --show-current)"
        echo "Last commit: $(git log -1 --format='%h - %s (%cr)')"
        echo ""
        echo "Status:"
        git status --short
        echo ""
        echo "Recent commits:"
        git log --oneline -5
    else
        echo "❌ Not a Git repository"
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
    read -p "Enter your choice (1-11): " choice

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
            push_updates
            ;;
        6)
            git_status
            ;;
        7)
            update_deps
            ;;
        8)
            resource_usage
            ;;
        9)
            backup_db
            ;;
        10)
            check_disk
            ;;
        11)
            echo "👋 Goodbye!"
            exit 0
            ;;
        *)
            echo "❌ Invalid option. Please try again."
            ;;
    esac
done