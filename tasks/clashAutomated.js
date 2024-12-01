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
            
            if(clanTagsToSync.length === 0) return;

            await this.ensureClanObjects(clanTagsToSync);
    
            this.client.addClans(clanTagsToSync);
            clanTagsToSync.forEach(tag => this.syncedClans.add(tag));
    
            this.client.on('maintenanceStart', this.handleMaintenanceStart);
            this.client.on('maintenanceEnd', this.handleMaintenanceEnd);
            this.client.on('error', this.handleError);
            this.client.on('newSeasonStart', this.handleNewSeasonStart);
        } catch (error) {
            logger.error('Error registering lifecycle events:', error);
        }
    }
    

    async getClanTagsToSync() {
        const result = await this.mysqlService.execute('SELECT clanTag FROM clan WHERE isToBeSynced=1');
        return result.map((clan) => clan.clanTag);
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
        oldClan.members.forEach((oldMember) => {
            if (!newClan.members.find((member) => member.tag === oldMember.tag)) {
                this.logClanEvent(
                    'clanMemberChange',
                    oldClan,
                    newClan,
                    `${oldMember.name} (${oldMember.tag}) left the clan`
                );
            }
        });

        newClan.members.forEach((newMember) => {
            if (!oldClan.members.find((member) => member.tag === newMember.tag)) {
                this.logClanEvent(
                    'clanMemberChange',
                    oldClan,
                    newClan,
                    `${newMember.name} (${newMember.tag}) joined the clan`
                );
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
}

module.exports = new ClashAutomated();
