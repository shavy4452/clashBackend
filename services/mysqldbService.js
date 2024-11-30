const mysql = require('mysql2/promise');
const config = require('../config/config');
const logger = require('../utils/logger');

class MySQLService {
    constructor() {
        this.pool = mysql.createPool({
            host: config.db.host,
            user: config.db.username,
            password: config.db.password,
            database: config.db.database,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
        });
    }

    async testConnection() {
        let connection;
        try {
            connection = await this.pool.getConnection();
            return true;
        } catch (error) {
            logger.error('[MySQLService] Connection Test Error:', error.message);
            return false;
        } finally {
            if (connection) {
                connection.release();
            }
        }
    }

    /**
     * Executes a single query with optional parameters.
     * @param {string} query - The SQL query to execute.
     * @param {Array} params - Optional parameters for the query.
     * @returns {Promise<Object>} - The result of the query.
     */
    async execute(query, params = []) {
        let connection;
        try {
            connection = await this.pool.getConnection();
            const [results] = await connection.execute(query, params);
            return results;
        } catch (error) {
            console.error('[MySQLService] Query Execution Error:', error.message);
            throw error;
        } finally {
            if (connection) {
                connection.release();
            }
        }
    }

    /**
     * Executes a batch of queries within a single transaction.
     * @param {Array} queries - An array of objects, each with `sql` and `params` properties.
     * @example
     * [
     *   { sql: "INSERT INTO table (column1, column2) VALUES (?, ?)", params: [value1, value2] },
     *   { sql: "UPDATE table SET column1 = ? WHERE id = ?", params: [value, id] }
     * ]
     * @returns {Promise<void>}
     */
    async executeBatch(queries) {
        let connection;
        try {
            connection = await this.pool.getConnection();
            await connection.beginTransaction();

            // Ensure all queries are executed in a valid connection
            for (const { query, params } of queries) {
                if (connection.connection._closed) {
                    throw new Error('Connection has been closed');
                }
                await connection.execute(query, params);
            }

            await connection.commit();
            logger.info(`[MySQLService] Batch executed successfully: ${queries.length} queries`);
        } catch (error) {
            if (connection) await connection.rollback();
            logger.error('[MySQLService] Batch Execution Error:', error.message);
            throw error;
        } finally {
            if (connection) {
                connection.release();
            }
        }
    }

    /**
     * Closes the database pool.
     */
    async close() {
        try {
            await this.pool.end();
            logger.info('[MySQLService] Connection pool closed');
        } catch (error) {
            logger.error('[MySQLService] Error closing connection pool:', error.message);
        }
    }
}

// Export a singleton instance of MySQLService
module.exports = new MySQLService();
