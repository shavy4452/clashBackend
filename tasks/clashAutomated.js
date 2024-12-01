const clashService = require('../services/clashService');
const logger = require('../utils/logger');
const mysqlService = require('../services/mysqldbService');
const AuditLogger = require('../utils/AuditLogger.js');

class ClashAutomated {
    constructor() {
        this.clashService = clashService;
        this.mysqlService = mysqlService;
        this.client = clashService.client2;
        this.auditLogger = new AuditLogger(mysqlService);
        this.syncedClans = new Set();
        this.pollInterval = 5 * 60 * 1000;
    }

    async syncClashData() {
        await this.registerLifecycleEvents();
        this.registerClanEvents();
        this.registerPlayerEvents();

        logger.info('Clan data sync started');
        try {
            await this.client.init();
            logger.info('Clan data sync completed');

            this.startClanPolling();
        } catch (error) {
            logger.error('Failed to sync Clash of Clans data:', error);
        }
    }

    async registerLifecycleEvents() {
        try {
            const clanTagsToSync = await this.getClanTagsToSync();
    
            if (clanTagsToSync.length === 0) return;
    
            // Ensure clan objects exist in the database
            await this.ensureClanObjects(clanTagsToSync);
    
            // Sync all players from clans and database
            const allPlayers = await this.syncAllClanPlayers(clanTagsToSync);
            logger.info(`Synced total players: ${allPlayers.length}`);
    
            // Add clans to sync
            this.client.addClans(clanTagsToSync);
            clanTagsToSync.forEach(tag => this.syncedClans.add(tag));
    
            // Register lifecycle events
            this.client.on('maintenanceStart', this.handleMaintenanceStart);
            this.client.on('maintenanceEnd', this.handleMaintenanceEnd);
            this.client.on('error', this.handleError);
            this.client.on('newSeasonStart', this.handleNewSeasonStart);
        } catch (error) {
            console.log('Error:', error);
            logger.error('Error registering lifecycle events:', error);
        }
    }
    
    

    async getClanTagsToSync() {
        const result = await this.mysqlService.execute('SELECT clanTag FROM clan WHERE isToBeSynced=1');
        return result.map((clan) => clan.clanTag);
    }

    async syncAllClanPlayers(clanTagsToSync) {
        try {
            const allMembers = [];
    
            // Fetch clan members
            for (const tag of clanTagsToSync) {
                const clan = await this.client.rest.getClanMembers(tag);
                if (clan.res.ok) {
                    const members = clan.body.items.map(member => member.tag.replace('#', ''));
                    allMembers.push(...members);
                } else {
                    logger.warn(`Failed to fetch members for clan ${tag}`);
                }
            }
    
            // Get all players from the database
            const databasePlayersQuery = `SELECT playerTag FROM player`;
            const databasePlayers = await this.mysqlService.execute(databasePlayersQuery).then(rows =>
                rows.map(row => row.playerTag)
            );
    
            // Combine unique players (from clans and database)
            const uniquePlayers = [...new Set([...allMembers, ...databasePlayers])];
    
            // Ensure player objects exist and add them to sync
            await this.ensurePlayerObjects(uniquePlayers);
            this.client.addPlayers(uniquePlayers);
    
            return uniquePlayers;
        } catch (error) {
            logger.error('Error syncing all clan players:', error);
            return [];
        }
    }

    async ensurePlayerObjects(playerTags) {
        if (playerTags.length === 0) return;
    
        try {
            // Fetch existing players
            const playerTagsInSql = playerTags.map(tag => `'${tag}'`).join(',');
            const existingPlayersQuery = `SELECT playerTag FROM player WHERE playerTag IN (${playerTagsInSql})`;
            const existingPlayers = await this.mysqlService.execute(existingPlayersQuery).then(rows =>
                rows.map(row => row.playerTag)
            );
    
            // Identify missing players
            const missingPlayers = playerTags.filter(tag => !existingPlayers.includes(tag));
    
            // Insert missing players
            if (missingPlayers.length > 0) {
                const playerValues = missingPlayers.map(tag => `('${tag}', 1, NOW(), NOW())`).join(',');
                const insertQuery = `
                    INSERT INTO player (playerTag, isToBeTracked, firstseen, lastsynced) 
                    VALUES ${playerValues}
                `;
                await this.mysqlService.execute(insertQuery);
                logger.info(`Inserted ${missingPlayers.length} new players.`);
            }
    
            // Ensure current player objects are updated
            await this.ensureCurrentPlayerObjects(playerTags);
        } catch (error) {
            logger.error('Error ensuring player objects:', error);
        }
    }

    async ensureCurrentPlayerObjects(playerTags) {
        if (playerTags.length === 0) return;
    
        try {
            const playerTagsInSql = playerTags.map(tag => `'${tag}'`).join(',');
            const getPlayerIDsQuery = `SELECT id, playerTag FROM player WHERE playerTag IN (${playerTagsInSql})`;
            const playerIDs = await this.mysqlService.execute(getPlayerIDsQuery);
    
            if (playerIDs.length === 0) return;
    
            const existingPlayerIDsQuery = `SELECT playerid FROM currentplayerobject WHERE playerid IN (${playerIDs.map(player => player.id).join(',')})`;
            const existingPlayerIDs = await this.mysqlService.execute(existingPlayerIDsQuery).then(rows =>
                rows.map(row => row.playerid)
            );
    
            const missingPlayers = playerIDs.filter(player => !existingPlayerIDs.includes(player.id));
    
            for (const player of missingPlayers) {
                try {
                    const getPlayer = await this.client.rest.getPlayer(player.playerTag);
                    if (getPlayer.res.ok) {
                        const playerJSON = JSON.stringify(getPlayer.body).replace(/'/g, "''");
                        const insertQuery = `
                            INSERT INTO currentplayerobject (playerid, playerJSON) 
                            VALUES (?, ?)
                        `;
                        await this.mysqlService.execute(insertQuery, [player.id, playerJSON]);
                    }
                } catch (fetchError) {
                    logger.warn(`Failed to fetch data for player ${player.playerTag}:`, fetchError);
                }
            }
        } catch (error) {
            logger.error('Error ensuring current player objects:', error);
        }
    }

    async ensureClanObjects(clanTags) {
        try {
            const getClanIDsQuery = `SELECT id, clanTag FROM clan WHERE clanTag IN (${clanTags.map(tag => `'${tag}'`).join(',')})`;
            const clanIDs = await this.mysqlService.execute(getClanIDsQuery);
    
            if (clanIDs.length === 0) return; 
    
            const existingClanIDsQuery = `SELECT clanid FROM currentclanobject WHERE clanid IN (${clanIDs.map(clan => clan.id).join(',')})`;
            const existingClanIDs = await this.mysqlService.execute(existingClanIDsQuery).then(rows => rows.map(row => row.clanid));
    
            const missingClans = clanIDs.filter(clan => !existingClanIDs.includes(clan.id));
    
            for (const clan of missingClans) {
                try {
                    const getClan = await this.client.rest.getClan(clan.clanTag);
                    if (getClan.res.ok) {
                        const clanJSON = JSON.stringify(getClan.body).replace(/'/g, "''");
                        const insertQuery = 'INSERT INTO currentclanobject (clanid, clanJSON) VALUES (?, ?)';
                        await this.mysqlService.execute(insertQuery, [clan.id, clanJSON]);
                    }
                } catch (fetchError) {
                    logger.warn(`Failed to fetch data for clan ${clan.clanTag}:`, fetchError);
                }
            }
        } catch (error) {
            console.log('Error:', error);
            logger.error('Error ensuring clan objects:', error);
        }
    }
    

    startClanPolling() {
        setInterval(async () => {
            try {
                const newClanTags = await this.getClanTagsToSync();
                const clansToAdd = newClanTags.filter(tag => !this.syncedClans.has(tag));
    
                if (clansToAdd.length > 0) {
                    await this.ensureClanObjects(clansToAdd);
    
                    // Add new clans to sync
                    this.client.addClans(clansToAdd);
                    clansToAdd.forEach(tag => this.syncedClans.add(tag));
                    logger.info(`Added new clans to sync: ${clansToAdd.join(', ')}`);
                }
            } catch (error) {
                logger.error('Error while polling for new clans:', error);
            }
        }, this.pollInterval);
    }
    


    handleMaintenanceStart() {
        logger.info('Clash of Clans API is in maintenance mode. Data sync paused.');
    }

    handleMaintenanceEnd(duration) {
        logger.info(`API maintenance ended. Downtime was ${duration}ms.`);
    }

    handleError(error) {
        logger.error('Clash of Clans API error:', error);
        console.log('Error:', error);
    }

    handleNewSeasonStart() {
        logger.info('New season started');
    }

    registerPlayerEvents() {
        this.client.setPlayerEvent({ name: 'playerNameChange', filter: (oldPlayer, newPlayer) => oldPlayer.name !== newPlayer.name });
        this.client.setPlayerEvent({ name: 'playerRoleChange', filter: (oldPlayer, newPlayer) => oldPlayer.role !== newPlayer.role });
        this.client.setPlayerEvent({ name: 'playerClanChange', filter: (oldPlayer, newPlayer) => oldPlayer.clan.tag !== newPlayer.clan.tag });
        this.client.setPlayerEvent({ name: 'playerTownHallChange', filter: (oldPlayer, newPlayer) => oldPlayer.townHallLevel !== newPlayer.townHallLevel });
        this.client.setPlayerEvent({ name: 'playerChangedClan', filter: (oldPlayer, newPlayer) => oldPlayer.clan.tag !== newPlayer.clan.tag });
        this.client.setPlayerEvent({ name: 'playerJoinedClan', filter: (oldPlayer, newPlayer) => !oldPlayer.clan.tag && newPlayer.clan.tag });
        this.client.setPlayerEvent({ name: 'playerLeftClan', filter: (oldPlayer, newPlayer) => oldPlayer.clan.tag && !newPlayer.clan.tag });
        this.client.setPlayerEvent({ name: 'playerRoleChange', filter: (oldPlayer, newPlayer) => oldPlayer.role !== newPlayer.role });
        

    
        this.client.on('playerNameChange', (oldPlayer, newPlayer) => 
            this.logPlayerEvent('playerNameChange', oldPlayer, newPlayer, `Name changed from ${oldPlayer.name} to ${newPlayer.name}`)
        );
        this.client.on('playerRoleChange', (oldPlayer, newPlayer) => 
            this.logPlayerEvent('playerRoleChange', oldPlayer, newPlayer, `Role changed from ${oldPlayer.role} to ${newPlayer.role}`)
        );
        this.client.on('playerClanChange', (oldPlayer, newPlayer) => 
            this.logPlayerEvent('playerClanChange', oldPlayer, newPlayer, `Clan changed from ${oldPlayer.clan.tag} to ${newPlayer.clan.tag}`)
        );
        this.client.on('playerTownHallChange', (oldPlayer, newPlayer) => 
            this.logPlayerEvent('playerTownHallChange', oldPlayer, newPlayer, `Town Hall level changed from ${oldPlayer.townHallLevel} to ${newPlayer.townHallLevel}`)
        );
        this.client.on('playerChangedClan', (oldPlayer, newPlayer) => 
            this.logPlayerEvent('playerChangedClan', oldPlayer, newPlayer, `Joined clan ${newPlayer.clan.tag}`)
        );
        this.client.on('playerJoinedClan', (oldPlayer, newPlayer) => 
            this.logPlayerEvent('playerJoinedClan', oldPlayer, newPlayer, `Joined clan ${newPlayer.clan.tag}`)
        );
        this.client.on('playerLeftClan', (oldPlayer, newPlayer) => 
            this.logPlayerEvent('playerLeftClan', oldPlayer, newPlayer, `Left clan ${oldPlayer.clan.tag}`)
        );
        this.client.on('playerRoleChange', (oldPlayer, newPlayer) =>
            this.logPlayerEvent('playerRoleChange', oldPlayer, newPlayer, `Role changed from ${oldPlayer.role} to ${newPlayer.role}`)
        );

    }

    registerClanEvents() {
        const filters = this.getClanEventFilters();

        this.client.setClanEvent({ name: 'clanDescriptionChange', filter: filters.descriptionChange });
        this.client.setClanEvent({ name: 'clanLevelChange', filter: filters.levelChange });
        this.client.setClanEvent({ name: 'clanLocationChange', filter: filters.locationChange });
        this.client.setClanEvent({ name: 'clanWarLogChange', filter: filters.warLogChange });
        this.client.setClanEvent({ name: 'clanNameChange', filter: filters.nameChange });
        this.client.setClanEvent({ name: 'clanMemberChange', filter: filters.memberChange });
        this.client.setClanEvent({ name: 'clanMemberRoleChange', filter: filters.memberRoleChange });

        this.client.on('clanDescriptionChange', (oldClan, newClan) => 
            this.logClanEvent('clanDescriptionChange', oldClan, newClan, `Clan Description changed from ${oldClan.description} to ${newClan.description}`)
        );
        this.client.on('clanLevelChange', (oldClan, newClan) => 
            this.logClanEvent('clanLevelChange', oldClan, newClan, `Clan Level changed from ${oldClan.level} to ${newClan.level}`)
        );
        this.client.on('clanLocationChange', (oldClan, newClan) => 
            this.logClanEvent(
                'clanLocationChange',
                oldClan,
                newClan,
                `Location changed from ${oldClan.location.name} to ${newClan.location.name}`
            )
        );
        this.client.on('clanWarLogChange', (oldClan, newClan) => 
            this.logClanEvent(
                'clanWarLogChange',
                oldClan,
                newClan,
                `War log is now ${newClan.isWarLogPublic ? 'public' : 'private'}`
            )
        );
        this.client.on('clanNameChange', (oldClan, newClan) => 
            this.logClanEvent('clanNameChange', oldClan, newClan, `Name changed from ${oldClan.name} to ${newClan.name}`)
        );
        this.client.on('clanMemberChange', (oldClan, newClan) => this.handleClanMemberChange(oldClan, newClan));

        this.client.on('clanMemberRoleChange', (oldClan, newClan) => this.handleClanMemberRoleChange(oldClan, newClan));
    }

    getClanEventFilters() {
        return {
            descriptionChange: (oldClan, newClan) => oldClan.description !== newClan.description,
            levelChange: (oldClan, newClan) => oldClan.level !== newClan.level,
            locationChange: (oldClan, newClan) => {
                const oldLocation = oldClan.location ? oldClan.location.name : null;
                const newLocation = newClan.location ? newClan.location.name : null;
                return oldLocation !== newLocation;
            },            
            warLogChange: (oldClan, newClan) => oldClan.isWarLogPublic !== newClan.isWarLogPublic,
            nameChange: (oldClan, newClan) => oldClan.name !== newClan.name,
            memberChange: (oldClan, newClan) => oldClan.memberCount !== newClan.memberCount,
            memberRoleChange: (oldClan, newClan) => {
                const oldClanRoles = new Map(oldClan.members.map(member => [member.tag, member.role]));
                return newClan.members.some(newMember => 
                    oldClanRoles.has(newMember.tag) && oldClanRoles.get(newMember.tag) !== newMember.role
                );
            }
        };
    }

    handleClanMemberRoleChange(oldClan, newClan) {
        const newClanMap = new Map(newClan.members.map(member => [member.tag, member]));
    
        for (const oldMember of oldClan.members) {
            const newMember = newClanMap.get(oldMember.tag);
            if (newMember && oldMember.role !== newMember.role) {
                this.logClanEvent(
                    'clanMemberRoleChange',
                    oldClan,
                    newClan,
                    `${oldMember.name} (${oldMember.tag}) role changed from ${oldMember.role} to ${newMember.role}`
                );
            }
        }
    }    

    handleClanMemberChange(oldClan, newClan) {
        const oldMembersMap = new Map(oldClan.members.map(member => [member.tag, member]));
        const newMembersMap = new Map(newClan.members.map(member => [member.tag, member]));
    
        // Handle members who left the clan
        oldClan.members.forEach(oldMember => {
            if (!newMembersMap.has(oldMember.tag)) {
                this.logClanEvent(
                    'clanMemberChange',
                    oldClan,
                    newClan,
                    `${oldMember.name} (${oldMember.tag}) left the clan`
                );
            }
        });
    
        // Handle members who joined the clan
        newClan.members.forEach(async newMember => {
            if (!oldMembersMap.has(newMember.tag)) {
                this.logClanEvent(
                    'clanMemberChange',
                    oldClan,
                    newClan,
                    `${newMember.name} (${newMember.tag}) joined the clan`
                );
    
                // Ensure the new player is synced
                const playerExistsQuery = `SELECT playerTag FROM player WHERE playerTag = ?`;
                const playerExists = await this.mysqlService.execute(playerExistsQuery, [newMember.tag]);
    
                if (playerExists.length === 0) {
                    // Add the new player to the database
                    const insertPlayerQuery = `
                        INSERT INTO player (playerTag, isToBeTracked, firstseen, lastsynced) 
                        VALUES (?, 1, NOW(), NOW())
                    `;
                    await this.mysqlService.execute(insertPlayerQuery, [newMember.tag]);

                    this.auditLogger.addPlayerAuditLog(newMember.tag, `Player joined the clan ${newClan.name} (${newClan.tag})`, 'playerJoinedClan', newMember);
                    logger.info(`New player added to sync: ${newMember.tag}`);
                }
    
                // Ensure player object exists
                await this.ensurePlayerObjects([newMember.tag]);
                this.client.addPlayers([newMember.tag]);
            }
        });
    }

    /**
     * Logs a clan event using the audit logger.
     * @param {string} eventType - The event type (e.g., clanDescriptionChange)
     * @param {object} oldClan - The old clan object
     * @param {object} newClan - The new clan object
     * @param {string} message - A description of the event
     */
    async logClanEvent(eventType, oldClan, newClan, message) {
        const clanJSON = JSON.stringify(newClan).replace(/'/g, "''"); // Prepare JSON for SQL
        
        // Log the event using the audit logger
        this.auditLogger.addClanAuditLog(newClan.tag, message, eventType, newClan);
    
        // Update the database with the new JSON
        try {
            const updateQuery = `
                UPDATE currentclanobject 
                SET clanJSON = ? 
                WHERE clanid = (SELECT id FROM clan WHERE clanTag = ? LIMIT 1)
            `;
            await this.mysqlService.execute(updateQuery, [clanJSON, newClan.tag]);
            logger.info(`Updated clanJSON for clan: ${newClan.name} (${newClan.tag})`);
        } catch (error) {
            console.log('Error:', error);
            logger.error(`Failed to update clanJSON for clan: ${newClan.name} (${newClan.tag}):`, error);
        }
        logger.info(`Logged event: ${eventType} for clan: ${newClan.name}`);
    }

    async logPlayerEvent(eventType, oldPlayer, newPlayer, message) {
        const playerJSON = JSON.stringify(newPlayer).replace(/'/g, "''"); // Prepare JSON for SQL
    
        // Log the event using the audit logger
        this.auditLogger.addPlayerAuditLog(newPlayer.tag, message, eventType, newPlayer);
    
        // Update the database with the new JSON
        try {
            const updateQuery = `
                UPDATE currentplayerobject 
                SET playerJSON = ? 
                WHERE playerid = (SELECT id FROM player WHERE playerTag = ? LIMIT 1)
            `;
            await this.mysqlService.execute(updateQuery, [playerJSON, newPlayer.tag]);
            logger.info(`Updated playerJSON for player: ${newPlayer.name} (${newPlayer.tag})`);
        } catch (error) {
            logger.error(`Failed to update playerJSON for player: ${newPlayer.name} (${newPlayer.tag}):`, error);
        }
        logger.info(`Logged event: ${eventType} for player: ${newPlayer.name}`);
    }
}

module.exports = new ClashAutomated();
