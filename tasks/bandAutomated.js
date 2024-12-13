const fs = require('fs');
const path = require('path');
const NodeCache = require('node-cache');
const BandService = require('../services/bandService');
const MongoService = require('../services/mongoService');
const logger = require('../utils/logger');

class BandAPISyncing {
    constructor() {
        this.pollingInterval = 30 * 1000;
        this.credentialsFetchInterval = 4 * 60 * 60 * 1000; // 4 hours
        this.cache = new NodeCache({ stdTTL: 60, checkperiod: 120 });
        this.credentials = null;
        this.lastFetchedCredentialsTime = 0;
        this.processedUsers = new Set(); // Track processed users within a poll cycle
        this.membersFilePath = path.join(__dirname,  '/../logs/band_members.json'); // Path to the file storing members data
    }

    async fetchCredentials() {
        try {
            const now = Date.now();
            if (!this.credentials || now - this.lastFetchedCredentialsTime > this.credentialsFetchInterval) {
                this.credentials = await MongoService.getCredentialBand();
                this.lastFetchedCredentialsTime = now;
                logger.info('Fetched new credentials');
            }
            return this.credentials;
        } catch (error) {
            logger.error('Error fetching credentials:', error);
            throw error;
        }
    }

    // Load the previous members data from a file if it exists
    loadPreviousMembers() {
        if (fs.existsSync(this.membersFilePath)) {
            const fileData = fs.readFileSync(this.membersFilePath, 'utf-8');
            try {
                return JSON.parse(fileData);
            } catch (error) {
                logger.error('Error parsing saved members data:', error);
            }
        }
        return {}; // Return an empty object if no data is found
    }

    // Save the current members data to a file
    saveMembersToFile(bandName, members) {
        const allMembers = this.loadPreviousMembers();
        allMembers[bandName] = members;
        fs.writeFileSync(this.membersFilePath, JSON.stringify(allMembers, null, 2));
        logger.info(`Saved members data for ${bandName} to file.`);
    }

    async detectChanges(bandName, newMembers) {
        const oldMembers = this.cache.get(bandName) || this.loadPreviousMembers()[bandName] || []; // Load previous members from file if cache is empty
        const newMemberMap = new Map(newMembers.map(member => [member.user_no, member]));

        const removedMembers = oldMembers.filter(oldMember => !newMemberMap.has(oldMember.user_no));
        if (removedMembers.length > 0) {
            removedMembers.forEach(async member => {
                var content = `▣ Left: Band ID #${bandName} #left\n\nName: ${member.name}\nRole: ${member.role}\nProfile: ${member.profile_image_url}\nAcount Created: ${member.created_at}\n`;
                await this.createNotificationPost(content);
                logger.info(`Removed members from ${bandName}:`);
            });
        }

        const oldMemberMap = new Map(oldMembers.map(member => [member.user_no, member]));
        const addedMembers = newMembers.filter(newMember => !oldMemberMap.has(newMember.user_no));
        if (addedMembers.length > 0) {
            addedMembers.forEach(async member => {
                var content = `◫ Joined: Band ID #${bandName} #joined\n\nName: ${member.name}\nProfile: ${member.profile_image_url}\nAcount Created: ${member.created_at}\n`;
                await this.createNotificationPost(content);
                logger.info(`Added members to ${bandName}:`);
            });
        }

        oldMembers.forEach(async oldMember => {
            const newMember = newMemberMap.get(oldMember.user_no);
            if (newMember) {
                // Check if any fields (name, description, profile_image_url) have changed
                const nameChanged = newMember.name !== oldMember.name;
                const descriptionChanged = newMember.description !== oldMember.description;
                const profileChanged = newMember.profile_image_url !== oldMember.profile_image_url;
        
                if ((nameChanged || descriptionChanged || profileChanged) && !this.processedUsers.has(newMember.user_no)) {
                    const nameChange = {
                        user_no: oldMember.user_no,
                        oldName: oldMember.name,
                        oldDescription: oldMember.description || '',
                        oldProfile: oldMember.profile_image_url || '',
                        newName: newMember.name,
                        newDescription: newMember.description || '',
                        newProfile: newMember.profile_image_url || '',
                        created_at: newMember.created_at,
                    };
        
                    logger.info(`Member changed in ${bandName}:`, nameChange);
        
                    let content = `Edited: Band ID #${nameChange.user_no} #edited name and/or description in #${bandName}\n\nPrevious:\nName: ${nameChange.oldName}\nDescription: ${nameChange.oldDescription}\nProfile: ${nameChange.oldProfile}\n\nCurrent:\nName: ${nameChange.newName}\nDescription: ${nameChange.newDescription}\nProfile: ${nameChange.newProfile}\nAcount Created: ${nameChange.created_at}\n`;
        
                    await this.createNotificationPost(content);
        
                    this.processedUsers.add(newMember.user_no);
                }
            }
        });

        // Update the cache and save to file
        this.cache.set(bandName, newMembers);
        this.saveMembersToFile(bandName, newMembers);
    }

    async createNotificationPost(content) {
        const credentials = await this.fetchCredentials();
        const { sk, auth, cookies } = credentials;
        const headers = {
            "Accept-Language": "en-US,en;q=0.9",
            "Content-Type": "application/x-www-form-urlencoded",
            "Connection": "keep-alive",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3",
            "Cookie": cookies,
        };
        BandService.createBandPost(content, '', "91806316", headers, sk, false);
    }

    async fetchBandData() {
        try {
            const credentials = await this.fetchCredentials();
            const { sk, auth, cookies } = credentials;
            const headers = {
                "Accept-Language": "en-US,en;q=0.9",
                "Content-Type": "application/x-www-form-urlencoded",
                "Connection": "keep-alive",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3",
                "Cookie": cookies,
            };

            const bandNos = {
                "FWL-ENTRY": 59381307,
                "gfidleaders": 59074391,
                "fwlsyncband": 63896472,
                "fwlcommunity": 94858646,
                "fwlstaffband": 95047486,
            };

            for (const [bandName, bandNo] of Object.entries(bandNos)) {
                const bandData = await BandService.getBandMembers(bandNo, headers, sk);
                if (bandData.success) {
                    const members = bandData.data.result_data.members || [];
                    await this.detectChanges(bandName, members);
                } else {
                    logger.warn(`Failed to fetch data for ${bandName}`);
                }
            }
        } catch (error) {
            logger.error('Error fetching band data:', error);
        }
    }

    startPolling() {
        this.stopPolling(); // Ensure no duplicate intervals are running

        this.polling = setInterval(async () => {
            await this.fetchBandData();
            this.processedUsers.clear(); // Clear processed users after each poll
        }, this.pollingInterval);

        logger.info('Polling started');
    }

    stopPolling() {
        if (this.polling) {
            clearInterval(this.polling);
            this.polling = null;
            logger.info('Polling stopped');
        }
    }
}

module.exports = BandAPISyncing;
