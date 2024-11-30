const logger = require("./logger");

class AuditLogger {
    constructor(mysqlService) {
        this.mysqlService = mysqlService;
        this.batchSize = 10; // Max number of logs per batch
        this.logs = [];
        this.flushTimeout = null;
    }

    addClanAuditLog(clanTag, message, eventType) {
        const log = {
            clanTag,
            message,
            eventType,
            timestamp: new Date(),
        };
        this.logs.push(log);

        if (this.logs.length >= this.batchSize) {
            this.flushLogs();
        } else {
            if (!this.flushTimeout) {
                this.flushTimeout = setTimeout(() => this.flushLogs(), 60000); // Flush logs after 1 minute
            }
        }
    }

    async flushLogs() {
        if (this.logs.length === 0) return;

        try {
            logger.info(`Flushing ${this.logs.length} logs to the database`);
            const isConnected = await this.mysqlService.testConnection();
            if (!isConnected) {
                logger.error('MySQL connection is closed. Cannot flush logs');
                return;
            }

            const queries = await Promise.all(
                this.logs.map(async (log) => {
                    if(log.clanTag.startsWith('#')) {
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
                        query: `INSERT INTO ClanAuditLogs(clan_id, event_type, detailedData, added_on) VALUES (?, ?, ?, ?)`,
                        params: [clan_id, log.eventType, log.message, log.timestamp],
                    };
                })
            );
            
            const validQueries = queries.filter(query => query !== null);
            
            if (validQueries.length > 0) {
                await this.mysqlService.executeBatch(validQueries);
            } else {
                logger.warn('No valid logs to flush');
            };
            logger.info('Logs flushed successfully');
            this.logs = []; // Clear logs after flushing
        } catch (error) {
            console.error('Error while flushing logs:', error.message);
            logger.error('Error while flushing logs:', error);
        } finally {
            clearTimeout(this.flushTimeout);
            this.flushTimeout = null;
        }
    }
}

module.exports = AuditLogger;