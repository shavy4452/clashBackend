const clashService = require('../services/clashService');
const logger = require('../utils/logger');
const mysqlService = require('../services/mysqldbService');
const AuditLogger = require('../utils/AuditLogger.js');
const fs = require('fs');
const BandService = require('../services/bandService');

class ClashAutomated {
    constructor() {
        this.clashService = clashService;
        this.mysqlService = mysqlService;
        this.client = clashService.client2;
        this.auditLogger = new AuditLogger(mysqlService);
        this.syncedClans = new Set();
        this.pollInterval = 5 * 60 * 1000;
        this.bandService = new BandService();
    }

    async syncClashData() {
        await this.registerLifecycleEvents();
        this.registerClanEvents();
        this.registerPlayerEvents();
        this.registerWarEvents();

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
    
            await this.ensureClanObjects(clanTagsToSync);
            await this.ensureWarObjects(clanTagsToSync);
    
            const allPlayers = await this.syncAllClanPlayers(clanTagsToSync);
            logger.info(`Synced total players: ${allPlayers.length}`);
            logger.info(`Synced total clans: ${clanTagsToSync.length}`);
            logger.info(`Synced total wars: ${clanTagsToSync.length}`);
    
            this.client.addClans(clanTagsToSync);
            this.client.addWars(clanTagsToSync);
            clanTagsToSync.forEach(tag => this.syncedClans.add(tag));
    
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
    
            for (const tag of clanTagsToSync) {
                const clan = await this.client.rest.getClanMembers(tag);
                if (clan.res.ok) {
                    const members = clan.body.items.map(member => member.tag.replace('#', ''));
                    allMembers.push(...members);
                } else {
                    logger.warn(`Failed to fetch members for clan ${tag}`);
                }
            }
    
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

    async ensureWarObjects(clanTags) {
        if (clanTags.length === 0) return;
        try {
            let sqlQuery = '';
            let successCount = 0;
            let failureCount = 0;
            let alreadyExistsCount = 0;
            const getWarIDsQuery = `SELECT id, clanTag FROM clan WHERE clanTag IN (${clanTags.map(tag => `'${tag}'`).join(',')})`;
            const warIDs = await this.mysqlService.execute(getWarIDsQuery);
    
            if (warIDs.length === 0) return;
    
            for (const war of warIDs) {
                try {
                    const getWar = await this.client.rest.getCurrentWar(war.clanTag);
    
                    if (getWar.res.status === 403) {
                        logger.info(`War log is private for clan: ${war.clanTag}`);
                        failureCount++;
                        continue;
                    }
    
                    if (getWar.res.ok && getWar.body.state !== 'notInWar') {
                        const warJSON = JSON.stringify(getWar.body).replace(/'/g, "''");
    
                        const getWarIdQuery = `SELECT id FROM warlogrecords WHERE startTime = ? AND endTime = ? AND opponentClanTag = ? AND clan_id = (SELECT id FROM clan WHERE clanTag = ?)`;
                        const warIdResult = await this.mysqlService.execute(getWarIdQuery, [
                            getWar.body.startTime, 
                            getWar.body.endTime, 
                            getWar.body.opponent.tag.replace('#', ''),
                            war.clanTag.replace('#', '')
                        ]);
    
                        if (warIdResult.length === 0) {
                            sqlQuery = `SELECT majorLeagueInfo, minorLeagueInfo FROM leagueinfo WHERE clan_id = (SELECT id FROM clan WHERE clanTag = ?)`;
                            let opponentLeagueDuringWar = await this.mysqlService.execute(sqlQuery, [getWar.body.opponent.tag.replace('#', '')]);
    
                            if (opponentLeagueDuringWar.length === 0) {
                                opponentLeagueDuringWar = "NONE";
                            } else {
                                opponentLeagueDuringWar = opponentLeagueDuringWar[0].majorLeagueInfo + ' ' + opponentLeagueDuringWar[0].minorLeagueInfo;
                            }
    
                            sqlQuery = `INSERT INTO warlogrecords (clan_id, startTime, endTime, opponentClanTag, oppoentClanName, opponentLeagueDuringWar, clanStars, opponentStars, trackedState, added_on, warLogJSON) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`;
                            var result = await this.mysqlService.execute(sqlQuery, [
                                war.id,
                                getWar.body.startTime, 
                                getWar.body.endTime, 
                                getWar.body.opponent.tag.replace('#', ''), 
                                getWar.body.opponent.name, 
                                opponentLeagueDuringWar, 
                                getWar.body.clan.stars, 
                                getWar.body.opponent.stars, 
                                getWar.body.state,
                                warJSON
                            ]);
                            if(result.affectedRows > 0) {
                                successCount++;
                            }
                            logger.info(`Inserted new war record for clan: ${getWar.body.clan.name} (${getWar.body.clan.tag})`);
                        }else{
                            alreadyExistsCount++;
                            sqlQuery = `UPDATE warlogrecords SET warLogJSON = ?, clanStars = ?, opponentStars = ?, trackedState = ? WHERE id = ?`;
                            var result = await this.mysqlService.execute(sqlQuery, [warJSON, getWar.body.clan.stars, getWar.body.opponent.stars, getWar.body.state, warIdResult[0].id]);
                            if(result.affectedRows > 0) {
                                successCount++;
                            }
                        }
                    }
                } catch (error) {
                    logger.error(`Error processing clan ${war.clanTag}:`, error);
                    failureCount++;
                }   
            }
            logger.info(`Inserted ${successCount} new war records, ${alreadyExistsCount} already exists, ${failureCount} failed.`);
        } catch (error) {
            logger.error('Error ensuring war objects:' + error);
            console.log('Error T:', error);
        }
    }

    async ensurePlayerObjects(playerTags) {
        if (playerTags.length === 0) return;
    
        try {
            // Fetch existing players
            if(playerTags.length > 0) {
                for (let i = 0; i < playerTags.length; i++) {
                    playerTags[i] = playerTags[i].replace('#', '');
                }
            }else{
                return;
            }
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
                    await this.ensureWarObjects(clansToAdd);
    
                    this.client.addClans(clansToAdd);
                    this.client.addWars(clansToAdd);
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
        logger.error('Clash of Clans API error:' + error);
    }

    handleNewSeasonStart() {
        logger.info('New season started');
    }

    registerWarEvents() {
        this.client.setWarEvent({ name: 'warEnd', filter: (oldWar, newWar) => oldWar.state === 'inWar' && newWar.state === 'warEnded' });
        this.client.setWarEvent({ name: 'warBegin', filter: (oldWar, newWar) => oldWar.state === 'preparation' && newWar.state === 'inWar' });
        this.client.setWarEvent({ name: 'newWar', filter: (oldWar, newWar) => !oldWar && newWar.state === 'preparation' });
        this.client.setWarEvent({ name: 'newWarJustStarted', filter: (oldWar, newWar) => oldWar.state === 'warEnded' && newWar.state === 'preparation' });
        this.client.setWarEvent({
            name: 'warClanChange',
            filter: (oldWar, newWar) => oldWar && newWar && oldWar.opponent && newWar.opponent && oldWar.opponent.tag !== newWar.opponent.tag
        });
        this.client.setWarEvent({
            name: 'warClanStarsChange',
            filter: (oldWar, newWar) => oldWar && newWar && oldWar.clan && newWar.clan && oldWar.clan.stars !== newWar.clan.stars
        });
        this.client.setWarEvent({
            name: 'warOpponentStarsChange',
            filter: (oldWar, newWar) => oldWar && newWar && oldWar.opponent && newWar.opponent && oldWar.opponent.stars !== newWar.opponent.stars
        });
        this.client.setWarEvent({
            name: 'warAttacksChange',
            filter: (oldWar, newWar) => {
                const clanAttacksChanged = oldWar && newWar && oldWar.clan && newWar.clan && oldWar.clan.attacks !== newWar.clan.attacks;
                const opponentAttacksChanged = oldWar && newWar && oldWar.opponent && newWar.opponent && oldWar.opponent.attacks !== newWar.opponent.attacks;
                return clanAttacksChanged || opponentAttacksChanged;
            }
        });
        

        this.client.on('warEnd', (oldWar, newWar) => this.logWarEvent('warEnd', oldWar, newWar, 'War ended'));
        this.client.on('warBegin', (oldWar, newWar) => this.logWarEvent('warBegin', oldWar, newWar, 'War day started'));
        this.client.on('newWar', (oldWar, newWar) => this.logWarEvent('newWar', oldWar, newWar, 'New war started'));
        this.client.on('newWarJustStarted', (oldWar, newWar) => this.logWarEvent('newWarJustStarted', oldWar, newWar, 'New war just started'));
        this.client.on('warClanChange', (oldWar, newWar) => this.logWarEvent('warClanChange', oldWar, newWar, 'Opponent clan changed'));
        this.client.on('warClanStarsChange', (oldWar, newWar) => this.logWarEvent('warClanStarsChange', oldWar, newWar, 'Clan stars changed'));
        this.client.on('warOpponentStarsChange', (oldWar, newWar) => this.logWarEvent('warOpponentStarsChange', oldWar, newWar, 'Opponent stars changed'));
        this.client.on('warAttacksChange', (oldWar, newWar) => this.logWarEvent('warAttacksChange', oldWar, newWar, 'Clan attacks changed'));
    }

    registerPlayerEvents() {
        this.client.setPlayerEvent({ name: 'playerNameChange', filter: (oldPlayer, newPlayer) => oldPlayer.name !== newPlayer.name });
        this.client.setPlayerEvent({ name: 'playerRoleChange', filter: (oldPlayer, newPlayer) => oldPlayer.role !== newPlayer.role });
        this.client.setPlayerEvent({
            name: 'playerClanChange',
            filter: (oldPlayer, newPlayer) => {
                const oldClanTag = oldPlayer.clan?.tag || null; // Safely access oldPlayer.clan.tag
                const newClanTag = newPlayer.clan?.tag || null; // Safely access newPlayer.clan.tag
                return oldClanTag !== newClanTag;
            }
        });        
        this.client.setPlayerEvent({ name: 'playerTownHallChange', filter: (oldPlayer, newPlayer) => oldPlayer.townHallLevel !== newPlayer.townHallLevel });
        this.client.setPlayerEvent({
            name: 'playerChangedClan',
            filter: (oldPlayer, newPlayer) => {
                const oldClanTag = oldPlayer.clan?.tag || null;
                const newClanTag = newPlayer.clan?.tag || null;
                return oldClanTag !== newClanTag;
            }
        });
        
        this.client.setPlayerEvent({
            name: 'playerJoinedClan',
            filter: (oldPlayer, newPlayer) => {
                const oldClanTag = oldPlayer.clan?.tag || null;
                const newClanTag = newPlayer.clan?.tag || null;
                return !oldClanTag && newClanTag;
            }
        });
        
        this.client.setPlayerEvent({
            name: 'playerLeftClan',
            filter: (oldPlayer, newPlayer) => {
                const oldClanTag = oldPlayer.clan?.tag || null;
                const newClanTag = newPlayer.clan?.tag || null;
                return oldClanTag && !newClanTag;
            }
        });
        
        this.client.setPlayerEvent({
            name: 'playerRoleChange',
            filter: (oldPlayer, newPlayer) => {
                const oldRole = oldPlayer.role || null;
                const newRole = newPlayer.role || null;
                return oldRole !== newRole;
            }
        });
        
        

    
        this.client.on('playerNameChange', (oldPlayer, newPlayer) => 
            this.logPlayerEvent('playerNameChange', oldPlayer, newPlayer, `Name changed from ${oldPlayer.name} to ${newPlayer.name}`)
        );
        this.client.on('playerRoleChange', (oldPlayer, newPlayer) => {
            var message = ""
            if(oldPlayer.role === newPlayer.role) return;
            if(oldPlayer.role === null && newPlayer.role !== null){
                message = `Player joined a clan ${newPlayer.clan.name} (${newPlayer.clan.tag}) and got role ${newPlayer.role}.`;
            }else if(oldPlayer.role !== null && newPlayer.role === null){
                message = `Player left a clan ${oldPlayer.clan.name} (${oldPlayer.clan.tag}).`;
            }
            this.logPlayerEvent('playerRoleChange', oldPlayer, newPlayer, message);
        });

        this.client.on('playerClanChange', (oldPlayer, newPlayer) => {
            // If the player left the clan
            if (oldPlayer.clan && !newPlayer.clan) {
                this.logPlayerEvent('playerClanChange', oldPlayer, newPlayer, `Clan left: ${oldPlayer.clan.tag}`);
            } 
            // If the player joined a new clan
            else if (!oldPlayer.clan && newPlayer.clan) {
                this.logPlayerEvent('playerClanChange', oldPlayer, newPlayer, `Joined clan: ${newPlayer.clan.tag}`);
            } 
            // If the player changed from one clan to another
            else if (oldPlayer.clan && newPlayer.clan) {
                this.logPlayerEvent('playerClanChange', oldPlayer, newPlayer, `Clan changed from ${oldPlayer.clan.tag} to ${newPlayer.clan.tag}`);
            } 
            else {
                console.error('Error: Both oldPlayer and newPlayer are clanless or data is missing.');
            }
        });
        this.client.on('playerTownHallChange', (oldPlayer, newPlayer) => 
            this.logPlayerEvent('playerTownHallChange', oldPlayer, newPlayer, `Town Hall level changed from ${oldPlayer.townHallLevel} to ${newPlayer.townHallLevel}`)
        );
        this.client.on('playerChangedClan', (oldPlayer, newPlayer) => {
            // Handle the case where the player has joined a new clan
            if (!oldPlayer.clan && newPlayer.clan) {
                this.logPlayerEvent('playerChangedClan', oldPlayer, newPlayer, `Joined clan ${newPlayer.clan.tag}`);
            } 
            else if (oldPlayer.clan && newPlayer.clan) {
                this.logPlayerEvent('playerChangedClan', oldPlayer, newPlayer, `Changed clan from ${oldPlayer.clan.tag} to ${newPlayer.clan.tag}`);
            }
            else if (oldPlayer.clan && !newPlayer.clan) {
                this.logPlayerEvent('playerChangedClan', oldPlayer, newPlayer, `Left clan ${oldPlayer.clan.tag}`);
            }
            // Handle other edge cases or errors
            else {
                console.error('Error: Unexpected player data or player already had a clan.');
            }
        });
        this.client.on('playerJoinedClan', (oldPlayer, newPlayer) => 
            this.logPlayerEvent('playerJoinedClan', oldPlayer, newPlayer, `Joined clan ${newPlayer.clan.tag}`)
        );
        this.client.on('playerLeftClan', (oldPlayer, newPlayer) => 
            this.logPlayerEvent('playerLeftClan', oldPlayer, newPlayer, `Left clan ${oldPlayer.clan.tag}`)
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
                if (newMember.role === null) {
                    this.logClanEvent(
                        'clanMemberRoleChange',
                        oldClan,
                        newClan,
                        `Member ${oldMember.name} (${oldMember.tag}) left the clan`
                    );
                } else {
                    this.logClanEvent(
                        'clanMemberRoleChange',
                        oldClan,
                        newClan,
                        `${oldMember.name} (${oldMember.tag}) role changed from ${oldMember.role} to ${newMember.role}`
                    );
                }
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
                    this.auditLogger.addPlayerAuditLog(newMember.tag, `Player was seen for the first time in system`, 'ADDED', newMember);
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

    async logWarEvent(eventType, oldWar, newWar, message) {
        const warJSON = JSON.stringify(newWar).replace(/'/g, "''");
        try {
            if(eventType === 'warEnd'){
                const updateQuery = `
                    UPDATE warlogrecords 
                    SET warLogJSON = ?, clanStars = ?, opponentStars = ?, trackedState = ? 
                    WHERE clan_id = (SELECT id FROM clan WHERE clanTag = ? LIMIT 1) AND endTime = ?
                `;
                await this.mysqlService.execute(updateQuery, [warJSON, newWar.clan.stars, newWar.opponent.stars, newWar.state, newWar.clan.tag.replace('#', ''), ""+newWar.endTime+""]);
                if(newWar.clan.members.length > 0){
                    for (const ClanWarMember in newWar.clan.members) {
                        const member = newWar.clan.members[ClanWarMember];
                        var auditMessage = '';
                        if (member.attacks.length > 0) {
                            for (const ClanWarAttack in member.attacks) {
                                let getWarID = `SELECT id FROM warlogrecords WHERE startTime = ? AND endTime = ? AND opponentClanTag = ? AND clan_id = (SELECT id FROM clan WHERE clanTag = ?)`;
                                var warID = await this.mysqlService.execute(getWarID, [newWar.startTime, newWar.endTime, newWar.opponent.tag.replace('#', ''), newWar.clan.tag.replace('#', '')]);
                                const attack = member.attacks[ClanWarAttack];
                                if (attack.length > 0) {
                                    const playerTag = member.tag.replace('#', '');
                                    const opponentTag = attack.defenderTag.replace('#', '');
                                    const stars = attack.stars;
                                    const destructionPercentage = attack.destructionPercentage;
                                    const mapPosition = attack.mapPosition;
                                    auditMessage = `Player ${playerTag} attacked ${opponentTag} and got ${stars} stars with ${destructionPercentage}% destruction in war against ${opponentTag} at map position ${mapPosition}`;
                                    this.auditLogger.addPlayerAuditLog(playerTag, auditMessage, 'playerAttacked', member);
                                }else{
                                    const playerTag = member.tag.replace('#', '');
                                    auditMessage = `${member.name} ${playerTag} did not attack in war of ${newWar.clan.name} (${newWar.clan.tag}) against ${newWar.opponent.name} (${newWar.opponent.tag}) at map position ${member.mapPosition} in war ID ${warID[0].id}`;
                                    this.auditLogger.addPlayerAuditLog(playerTag, auditMessage, 'playerAttacked', member);
                                }
                            }
                        }
                    }
                }
            }
            else if(eventType === 'newWar' || eventType === 'newWarJustStarted' || eventType === 'warClanChange'){
                if (newWar.state === 'notInWar') {
                    return;
                }
                const getWarIdQuery = `SELECT id FROM warlogrecords WHERE startTime = ? AND endTime = ? AND opponentClanTag = ? AND clan_id = (SELECT id FROM clan WHERE clanTag = ?)`;
                const warIdResult = await this.mysqlService.execute(getWarIdQuery, [
                    newWar.startTime, 
                    newWar.endTime, 
                    newWar.opponent.tag.replace('#', ''),
                    newWar.clan.tag.replace('#', '')
                ]);

                if (warIdResult.length === 0) {
                    sqlQuery = `SELECT majorLeagueInfo, minorLeagueInfo FROM leagueinfo WHERE clan_id = (SELECT id FROM clan WHERE clanTag = ?)`;
                    let opponentLeagueDuringWar = await this.mysqlService.execute(sqlQuery, [newWar.opponent.tag.replace('#', '')]);

                    if (opponentLeagueDuringWar.length === 0) {
                        opponentLeagueDuringWar = "NONE";
                    } else {
                        opponentLeagueDuringWar = opponentLeagueDuringWar[0].majorLeagueInfo + ' ' + opponentLeagueDuringWar[0].minorLeagueInfo;
                    }

                    sqlQuery = `INSERT INTO warlogrecords (clan_id, startTime, endTime, opponentClanTag, oppoentClanName, opponentLeagueDuringWar, clanStars, opponentStars, trackedState, added_on, warLogJSON) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`;
                    var result = await this.mysqlService.execute(sqlQuery, [
                        newWar.clan.id,
                        newWar.startTime, 
                        newWar.endTime, 
                        newWar.opponent.tag.replace('#', ''), 
                        newWar.opponent.name, 
                        opponentLeagueDuringWar, 
                        newWar.clan.stars, 
                        newWar.opponent.stars, 
                        newWar.state,
                        warJSON
                    ]);
                    if(result.affectedRows > 0) {
                        logger.info(`Inserted new war record for clan: ${newWar.clan.name} (${newWar.clan.tag})`);
                    }
                }
            }
            const updateQuery = `
                UPDATE warlogrecords 
                SET warLogJSON = ?, clanStars = ?, opponentStars = ?, trackedState = ? 
                WHERE clan_id = (SELECT id FROM clan WHERE clanTag = ? LIMIT 1) AND endTime = ?
            `;
            await this.mysqlService.execute(updateQuery, [warJSON, newWar.clan.stars, newWar.opponent.stars, newWar.state, newWar.clan.tag.replace('#', ''), ""+newWar.endTime+""]);
            

        } catch (error) {
            logger.error(`Failed to update warJSON for clan: ${newWar.clan.name} (${newWar.clan.tag}):`, error);
        }
        if(eventType === 'warEnd'){
            logger.info(`Logged event: ${eventType} for clan: ${newWar.clan.name} and updated attack logs`);
        }
        //logger.info(`Logged event: ${eventType} for clan: ${newWar.clan.name}`);
    }
}

module.exports = new ClashAutomated();
