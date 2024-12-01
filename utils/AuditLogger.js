const logger = require("./logger");

class AuditLogger {
    constructor(mysqlService) {
        this.mysqlService = mysqlService;
        this.batchSize = 10; // Max number of logs per batch
        this.clanLogs = [];
        this.playerLogs = [];
        this.flushTimeout = null;
    }

    addClanAuditLog(clanTag, message, eventType) {
        const log = {
            clanTag,
            message,
            eventType,
            timestamp: new Date(),
        };
        this.clanLogs.push(log);

        this.scheduleFlush();
    }

    addPlayerAuditLog(playerTag, message, eventType, playerObject) {
        const log = {
            playerTag,
            message,
            eventType,
            playerData: JSON.stringify(playerObject),
            timestamp: new Date(),
        };
        this.playerLogs.push(log);

        this.scheduleFlush();
    }

    scheduleFlush() {
        if (this.clanLogs.length >= this.batchSize || this.playerLogs.length >= this.batchSize) {
            this.flushLogs();
        } else if (!this.flushTimeout) {
            this.flushTimeout = setTimeout(() => this.flushLogs(), 60000); // Flush logs after 1 minute
        }
    }

    async flushLogs() {
        if (this.clanLogs.length === 0 && this.playerLogs.length === 0) return;
    
        try {
            logger.info(`Flushing ${this.clanLogs.length + this.playerLogs.length} logs to the database`);
            const isConnected = await this.mysqlService.testConnection();
            if (!isConnected) {
                logger.error('MySQL connection is closed. Cannot flush logs');
                return;
            }
    
            // Flush Clan Logs
            const clanQueries = await Promise.all(
                this.clanLogs.map(async (log) => {
                    if (log.clanTag.startsWith('#')) {
                        log.clanTag = log.clanTag.substring(1);
                    }
                    const clan_id_query = `SELECT id FROM clan WHERE clanTag = ?`;
                    const clanIdResult = await this.mysqlService.execute(clan_id_query, [log.clanTag]);
    
                    if (clanIdResult.length === 0) {
                        logger.warn(`Clan with tag ${log.clanTag} does not exist`);
                        return null; // Return null if the clan does not exist, handle accordingly.
                    }
    
                    const clan_id = clanIdResult[0].id; // Assuming 'id' is the field for clan id
    
                    return {
                        query: `INSERT INTO clanauditlogs(clan_id, event_type, detailedData, added_on) VALUES (?, ?, ?, ?)`,
                        params: [clan_id, log.eventType, log.message, log.timestamp],
                    };
                })
            );
    
            const validClanQueries = clanQueries.filter(query => query !== null);
    
            // Flush Player Logs
            const playerQueries = await Promise.all(
                this.playerLogs.map(async (log) => {
                    if (log.playerTag.startsWith('#')) {
                        log.playerTag = log.playerTag.substring(1);
                    }
    
                    const player_id_query = `SELECT id FROM player WHERE playerTag = ?`;
                    const playerIdResult = await this.mysqlService.execute(player_id_query, [log.playerTag]);
    
                    if (playerIdResult.length === 0) {
                        logger.warn(`Player with tag ${log.playerTag} does not exist`);
                        return null; // Return null if the player does not exist, handle accordingly.
                    }
    
                    const player_id = playerIdResult[0].id; // Assuming 'id' is the field for player id
                    return {
                        query: `INSERT INTO playerauditlogs(player_id, event_type, detailedData, added_on) VALUES (?, ?, ?, ?)`,
                        params: [player_id, log.eventType, log.message, log.timestamp],
                    };
                })
            );
    
            const validPlayerQueries = playerQueries.filter(query => query !== null);
    
            // Combine both queries
            const allQueries = [...validClanQueries, ...validPlayerQueries];
    
            if (allQueries.length > 0) {
                await this.mysqlService.executeBatch(allQueries);
            } else {
                logger.warn('No valid logs to flush');
            }
    
            logger.info('Logs flushed successfully');
            this.clanLogs = [];
            this.playerLogs = [];
        } catch (error) {
            console.error('Error while flushing logs:', error.message);
            logger.error('Error while flushing logs:', error.message);
        } finally {
            clearTimeout(this.flushTimeout);
            this.flushTimeout = null;
        }
    }
}

module.exports = AuditLogger;
