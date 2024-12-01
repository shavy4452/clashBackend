#!/bin/bash

# Deployment Script for Node.js Application

# Configuration
APP_NAME="clashBackend"       # Application name
REPO_URL="git@github.com:shavy4452/clashBackend.git" # Replace with your repository URL
APP_DIR="/data/$APP_NAME"     # Application directory
BRANCH="main"                    # Branch to deploy
CONFIG_DIR="/data/config"      # Configuration directory
CONFIG_FILE="config.js"      # Configuration file

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

create_config() {
    create_config() {
    echo "Creating $CONFIG_FILE..."
    mkdir -p $CONFIG_DIR
    cat <<EOL > $CONFIG_FILE
const config = {
    isProduction: true,
    env: "prod",
    port: 2229,
    domain: "http://localhost:2229",
    db: {
        host: "localhost",
        username: "root",
        password: "ITHB@23eUJ9QZapkFzd",
        database: "clashtracker"
    },
    mongoDB: {
        url: "mongodb+srv://shavy:sarvesh4452@cluster0.jh91n.mongodb.net/?retryWrites=true&w=majority",
        clanDB: "linking",
        playerDB: "player_linking",
        collection: "whatshapp"
    },
    clashApi: {
        username: "admin@clashpanda.xyz",
        password: "ClashPanda@0710",
        keyname: "dev backend"
    },
    jwt_secret: "kbvgedcyxuhjvgushdxhsfxdyguydsgxbuywgsyugbwquiu09w7878yhhyugduhudhytgysgysgftyfg",   
    webhook: "https://discord.com/api/webhooks/1193276775506116609/yO4ed16TkJPVdTvpFxj7zJfvmGFpsOPPo4n9QoJ8g_qtXsf7vf4m_vavWcy9cjWYBSgd"
};

module.exports = config;
EOL
    echo "$CONFIG_FILE created successfully."
}
}

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
