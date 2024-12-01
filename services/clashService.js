const { Client, BatchThrottler, QueueThrottler, Util, PollingClient } = require('clashofclans.js');
const logger = require('../utils/logger.js');
const chalk = require('chalk');

class ClashService {
    constructor() {
        this.client1 = new Client({
            cache: true,
            retryLimit: 3,
            restRequestTimeout: 5000,
            throttler: new BatchThrottler(30),

        });

        this.client2 = 
        new PollingClient({
            cache: false,
            retryLimit: 3,
            restRequestTimeout: 5000,
            throttler: new QueueThrottler(30),
        });

        this.util = Util;
    }

    async init(email, password) {
        try {
            await this.client1.login({ email, password , keyName: 'clashtracker', keyCount: 2, keyDescription: 'Clash Tracker API Key' });
            await this.client2.login({ email, password , keyName: 'clashtrackerbackend', keyCount: 5, keyDescription: 'Clash Tracker API Key' });
            logger.info('Successfully logged into Clash of Clans API');
        } catch (error) {
            console.error(chalk.red('[ERROR] Failed to login to Clash of Clans API:', error));
            logger.error('Failed to login to Clash of Clans API', error);
            throw error; // If login fails
        }
    }

    async getClan(clantag) {
        try {
            if (clantag.includes('#')) {
                clantag = clantag.replace('#', '');
            }
            let clan = await this.client1.getClan(clantag);
            return clan;
        } catch (error) {
            if (error.message != 'Requested resource was not found.') {
                console.error(chalk.red('[ERROR] Error fetching clan details:', error));
            }
            throw error;
        }
    }

    async getPlayer(playertag) {
        try {
            if (playertag.includes('#')) {
                playertag = playertag.replace('#', '');
            }
            let player = await this.client1.getPlayer(playertag);
            return player;
        } catch (error) {
            if (error.message != 'Requested resource was not found.') {
                console.error(chalk.red('[ERROR] Error fetching player details:', error));
            }
            throw error;
        }
    }

    async getCurrentWar(clantag) {
        let war = await this.client1.getCurrentWar(clantag);
        if (!war) {
            return JSON.parse('{"warlog": "private"}');
        }
        return war;
    }

    async getClanWarLog(clantag, limit=10){
        try{
            let warlog = await this.client.getClanWarLog(clantag, { limit: limit});
            if (!warlog) {
                return JSON.parse('{"warlog": "private"}');
            }
            return warlog;
        }catch(error){
            if (error.message != 'Requested resource was not found.') {
                console.error(chalk.red('[ERROR] Error fetching clan war log:', error));
            }
            throw error;
        }
    }
    
    async getTHLevels(clantag){
        try{
            if (clantag.includes('%23')) {
                clantag = clantag.replace('%23', '');
            }
            var clan = await this.client1.getClan(clantag);
            let THCounts = {
                3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 
                9: 0, 10: 0, 11: 0, 12: 0, 13: 0, 14: 0, 15: 0, 16: 0
            };
            clan.members.forEach(member => {
                const THLevel = member.townHallLevel;
                if (THCounts[THLevel] !== undefined) {
                    THCounts[THLevel]++;
                }
            });
            let townHalls = Object.entries(THCounts).map(([level, total]) => ({ level: parseInt(level), total })).filter(townHall => townHall.total > 0).reverse();
            let THWeights = {
                3: 6000, 4: 8000, 5: 18000, 6: 28000, 7: 38000, 8: 50000, 
                9: 63000, 10: 80000, 11: 102000, 12: 115000, 13: 125000, 
                14: 140000, 15: 150000, 16: 160000, 17: 170000
            };
            let totalTHCount = Object.values(THCounts).reduce((sum, count) => sum + count, 0);
            let sumTHLevels = Object.entries(THCounts).reduce((sum, [level, count]) => sum + (parseInt(level) * count), 0);
            let estWeight = Object.entries(THCounts).reduce((sum, [level, count]) => sum + (THWeights[level] * count), 0);
            let average = sumTHLevels / totalTHCount || 0;
            const resp = {
                name: clan.name,
                tag: clan.tag,
                townHalls,
                estWeight,
                average,
                total: totalTHCount
            };
            return resp;
        }catch(error){
            if (error.message != 'Requested resource was not found.') {
                console.error(chalk.red('[ERROR] Error fetching clan TH levels:', error));
            }
            throw error;
        }
    }

    
    async isClanTagValid(clantag){
        try{
            let isTagValid = await this.client1.util.isValidTag(clantag);
            if (!isTagValid) {
                return false;
            }
            return true;
        }catch(error){
            return false;
        }
    }

    async isPlayerTagValid(playertag){
        try{
            let isTagValid = await this.client1.util.isValidTag(playertag);
            if (!isTagValid) {
                return false;
            }
            return true;
        }catch(error){
            return false;
        }

    }
    async getCapitalRaidSeasons(clantag){
        try{
            let seasons = await this.client1.getCapitalRaidSeasons(clantag);
            return seasons;
        }catch(error){
            if (error.message != 'Requested resource was not found.') {
                console.error(chalk.red('[ERROR] Error fetching capital raid seasons:', error));
            }
            throw error;
        }
    }

    async getClanMembersHero(clantag){
        try{
            let clan = await this.client1.getClan(clantag);
            let clanMembers = clan.members;
            let membersWithHeroes = await Promise.all(
                clanMembers.map(async (member) => {
                    const memberCopy = { ...member }; 
                    try {
                        let playerData = await this.client1.getPlayer(member.tag);
                        memberCopy.heroes = playerData.heroes || []; // Add heroes or default to an empty array
                    } catch (error) {
                        console.error(`[ERROR] Failed to get player info for ${member.tag}:`, error.message);
                        memberCopy.heroes = []; // Default to an empty array on error
                    }
                    return memberCopy;
                })
            );
            clan.members = membersWithHeroes;
            return clan;
        }catch(error){
            if (error.message != 'Requested resource was not found.') {
                console.error(chalk.red('[ERROR] Error fetching clan members heroes:', error));
            }
            console.error(`[ERROR] Failed to get player info for ${member.tag}:`, error.message);
            throw error;
        }
    }

    async getPlayersInfo(playerTag){
        try{
            let player = await this.client1.getPlayer(playerTag);            
            return player;
        }catch(error){
            if (error.message != 'Requested resource was not found.') {
                console.error(chalk.red('[ERROR] Error fetching players info:', error));
            }
            throw error;
        }
    }

    async getClanMembers(clantag){
        try{
            let clan = await this.client1.getClanMembers(clantag);
            return clan;
        }catch(error){
            if (error.message != 'Requested resource was not found.') {
                console.error(chalk.red('[ERROR] Error fetching clan members:', error));
            }
            throw error;
        }
    }

    async getClanWarLeagueRound(clantag, round=1){
        try{
            console.log(clantag, round);
            let clan = await this.client1.getClanWarLeagueRound(clantag, round);
            console.log(clan);
            if (!clan) {
                return JSON.parse('{"warlog": "private"}');
            }
            return clan;
        }catch(error){
            if (error.message != 'Requested resource was not found.') {
                console.error(chalk.red('[ERROR] Error fetching clan war league round:', error));
            }
            throw error;
        }
    }

    async getCWLresults(clantag){
        try{
            let cwl = await this.client1.getClanWarLeagueGroup(clantag);
            return cwl;
        }catch(error){
            if (error.message != 'Requested resource was not found.') {
                console.error(chalk.red('[ERROR] Error fetching CWL results:', error));
            }
            throw error;
        }
    }
    async generateChangeLogForClan(oldData, newData){
        try{
            var logs = [];
            var now = new Date().toISOString();

            if (oldData.name !== newData.name) {
                logs.push(['clan_name_changed', `Clan Name changed from ${oldData.name} to ${newData.name}.`, now]);
            }

            if (oldData.isWarLogPublic !== newData.isWarLogPublic) {
                if (newData.isWarLogPublic) {
                    logs.push(['clan_warlog_public', 'Clan War Log has been made public.', now]);
                }
                else {  
                    logs.push(['clan_warlog_private', 'Clan War Log has been made private.', now]);
                }
            }

            if (oldData.description !== newData.description) {
                logs.push(['clan_description_changed', `Clan Description changed from ${oldData.description} to ${newData.description}.`, now]);
            }

            if (oldData.location && newData.location && oldData.location.name !== newData.location.name) {
                logs.push(['clan_location_changed', `Clan Location changed from ${oldData.location.name} to ${newData.location.name}.`, now]);
            }

            if (oldData.level !== newData.level) {
                logs.push(['clan_level_changed', `Clan Level changed from ${oldData.level} to ${newData.level}.`, now]);
            }

            if (oldData.memberCount === 0 && newData.memberCount > 0) {
                logs.push(['clan_reformed', 'Clan has been reformed.', now]);
                for (const member of newData.members) {
                    logs.push(['member_added', `Member ${member.name} (${member.tag}) has joined the clan.`, now]);
                }
            }
            if (newData.memberCount === 0 && oldData.memberCount > 0) {
                logs.push(['clan_disbanded', 'Clan has been disbanded.', now]);
                for (const member of oldData.members) {
                    logs.push(['member_removed', `Member ${member.name} (${member.tag}) has left the clan.`, now]);
                }
            }

            for (const oldMember of oldData.members) {
                const newMember = newData.members.find(member => member.tag === oldMember.tag);
                if (!newMember) {
                    logs.push(['member_removed', `Member ${oldMember.name} (${oldMember.tag}) has left the clan.`, now]);
                }
            }

            for (const newMember of newData.members) {
                const oldMember = oldData.members.find(member => member.tag === newMember.tag);
                if (!oldMember) {
                    logs.push(['member_added', `Member ${newMember.name} (${newMember.tag}) has joined the clan.`, now]);
                }
            }

            for (const oldMember of oldData.members) {
                const newMember = newData.members.find(member => member.tag === oldMember.tag);
                if (newMember) {
                    if (oldMember.role !== newMember.role) {
                        logs.push(['member_role_changed', `Role of Member ${newMember.name} (${newMember.tag}) changed from ${oldMember.role} to ${newMember.role}.`, now]);
                    }
                    if (oldMember.townHallLevel !== newMember.townHallLevel) {
                        logs.push(['member_th_level_changed', `Town Hall Level of Member ${newMember.name} (${newMember.tag}) changed from ${oldMember.townHallLevel} to ${newMember.townHallLevel}.`, now]);
                    }
                }
            }
            return logs;
        }catch(error){
            return [];
        }

    }
    async getWarWeight(clantag){
        try{
            let [TH17, TH16,TH15,TH14, TH13, TH12, TH11, TH10, TH09, TH08, TH07, TH06, TH05, TH04, TH03] = [
                0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,0
              ];
            const calcTH = (TownHAll) => {
                if (TownHAll === 17) TH17++;
                if (TownHAll === 16) TH16++;
                if (TownHAll === 15) TH15++;
                if (TownHAll === 14) TH14++;
                if (TownHAll === 13) TH13++;
                if (TownHAll === 12) TH12++;
                if (TownHAll === 11) TH11++;
                if (TownHAll === 10) TH10++;
                if (TownHAll === 9) TH09++;
                if (TownHAll === 8) TH08++;
                if (TownHAll === 7) TH07++;
                if (TownHAll === 6) TH06++;
                if (TownHAll === 5) TH05++;
                if (TownHAll === 4) TH04++;
                if (TownHAll === 3) TH03++;
            };
            const war = await this.client1.getClanWar(clantag);
            if (!war) {
                return JSON.parse('{"warlog": "private"}');
            }
            let sortedData = war.clan.members.sort(
                (a, b) => a.mapPosition - b.mapPosition
              );
            let range = sortedData.length > 0 ? sortedData[0].townHallLevel : 0;
            for (const data of sortedData) {
                let th = data.townHallLevel;
                if (th === range) {
                    calcTH(th);
                } else if (th < range) {
                    range = th;
                    calcTH(th);
                } else if (th > range) {
                    calcTH(range);
                }
            }
            const townHalls = [
                { level: 3, total: TH03 },
                { level: 4, total: TH04 },
                { level: 5, total: TH05 },
                { level: 6, total: TH06 },
                { level: 7, total: TH07 },
                { level: 8, total: TH08 },
                { level: 9, total: TH09 },
                { level: 10, total: TH10 },
                { level: 11, total: TH11 },
                { level: 12, total: TH12 },
                { level: 13, total: TH13 },
                { level: 14, total: TH14 },
                { level: 15, total: TH15 },
                { level: 16, total: TH16 },
                { level: 17, total: TH17 }
            ].filter((townHall) => townHall.total !== 0).reverse();
            const estWeight = (TH16 * 170000) + (TH16 * 160000) + (TH15 * 150000) + (TH14 * 140000) + (TH13 * 125000) + (TH12 * 115000) + (TH11 * 102000) + (TH10 * 80000) + (TH09 * 63000) + (TH08 * 50000) + (TH07 * 38000) + (TH06 * 28000) + (TH05 * 18000) + (TH04 * 8000) + (TH03 * 6000)
            const total = TH16 + TH15 + TH14 + TH13 + TH12 + TH11 + TH10 + TH09 + TH08 + TH07 + TH06 + TH05 + TH04 + TH03;
            let resp = {
                name: war.clan.name,
                tag: war.clan.tag,
                total,
                townHalls,
                estWeight
            };
            return resp; 

        }catch(error){
            if (error.message != 'Requested resource was not found.') {
                console.error(chalk.red('[ERROR] Error fetching clan war weight:', error));
            }
            throw error;
        }
    }
}

// Export a single instance of the ClashService
const clashService = new ClashService();
module.exports = clashService;
