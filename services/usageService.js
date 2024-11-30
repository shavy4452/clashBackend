const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

// Generate a file path based on the current date
const getUsageFilePath = () => {
    const today = new Date().toISOString().split('T')[0]; // Get YYYY-MM-DD
    if (!fs.existsSync(path.join(__dirname, '../logs/api'))) {
        fs.mkdirSync(path.join(__dirname, '../logs/api'));
    }
    return path.join(__dirname, `../logs/api/api-usage-${today}.json`);
};

// Initialize the usage file if it doesn't exist
const initDailyLogFile = () => {
    const usageFilePath = getUsageFilePath();
    if (!fs.existsSync(usageFilePath)) {
        fs.writeFileSync(usageFilePath, JSON.stringify({}));
    }
};

// Log API usage
const logApiUsage = async (secretKey, endpoint) => {
    try {
        const usageFilePath = getUsageFilePath();

        // Ensure the log file exists for today
        initDailyLogFile();

        // Read current usage data from the file
        const usageData = JSON.parse(fs.readFileSync(usageFilePath));

        // Increment the usage count for the secretKey
        if (!usageData[secretKey]) {
            usageData[secretKey] = { totalCalls: 0, endpoints: {} };
        }

        usageData[secretKey].totalCalls += 1;

        if (!usageData[secretKey].endpoints[endpoint]) {
            usageData[secretKey].endpoints[endpoint] = 0;
        }

        usageData[secretKey].endpoints[endpoint] += 1;

        // Write the updated usage data back to the file
        fs.writeFileSync(usageFilePath, JSON.stringify(usageData, null, 2));
    } catch (error) {
        console.error(chalk.red('Error logging API usage:'), error);
    }
};

module.exports = { logApiUsage };
