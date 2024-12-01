#!/bin/bash

# Deployment Script for Node.js Application

# Configuration
APP_NAME="clashBackend"       # Application name
REPO_URL="git@github.com:shavy4452/clashBackend.git" # Replace with your repository URL
APP_DIR="/data/$APP_NAME"     # Application directory
BRANCH="main"                    # Branch to deploy

echo "Starting deployment of $APP_NAME..."

# Step 1: Update System (Optional)
echo "Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Step 2: Clone Repository or Pull Latest Changes
if [ ! -d "$APP_DIR" ]; then
    echo "Cloning repository..."
    git clone $REPO_URL $APP_DIR
else
    echo "Pulling latest changes from $BRANCH branch..."
    cd $APP_DIR
    git fetch --all
    git reset --hard origin/$BRANCH
fi

# Step 3: Install Dependencies
echo "Installing dependencies..."
cd $APP_DIR
npm install --production

# Step 4: Build Application (if applicable)
if [ -f "package.json" ] && grep -q "\"build\"" package.json; then
    echo "Building application..."
    npm run build
fi

# Step 5: Restart Application with PM2
echo "Restarting application with PM2..."
if pm2 list | grep -q "$APP_NAME"; then
    pm2 restart $APP_NAME
else
    pm2 start index.js --name "$APP_NAME"
fi

# Save PM2 Process List (Optional)
pm2 save

# Step 6: Clean Up
echo "Cleaning up old dependencies..."
npm prune --production

echo "Deployment of $APP_NAME completed successfully!"
