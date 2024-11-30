const mysqlService = require('./services/mysqldbService');

async function checkMySQLConnection() {
    const isConnected = await mysqlService.testConnection();
    if (isConnected) {
        console.log('MySQL connection is successful');
    } else {
        console.log('Failed to connect to MySQL');
    }
}

checkMySQLConnection();