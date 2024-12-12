const clashService = require('../services/clashService');
const logger = require('../utils/logger.js');
const chalk = require('chalk');
const db = require('../services/mysqldbService.js');

class ClashController {

    static async getPlayersHistory(req, res) {
        try{
            var { tag } = req.params; // get player tag from URL
            if (tag === undefined) {
                return res.status(200).json({ success: false, message: 'Player tag is required' });
            }
    
            const limit = parseInt(req.query.limit) || 10;
    
            tag = decodeURIComponent(tag);

            if(tag.startsWith('#')) {
                tag = tag.substring(1);
            }

            const checkTag = tag.startsWith('#') ? tag : `#${tag}`;
            const isValid = await clashService.isPlayerTagValid(checkTag);

            if (!isValid) {
                return res.status(200).json({ success: false, message: 'Invalid player tag' });
            }

            var sqlQuery = 'SELECT id FROM player WHERE playerTag = ?';
            var result = await db.execute(sqlQuery, [tag.toUpperCase()]);

            if (result.length === 0) {
                return res.status(200).json({ success: false, message: 'Player not found' });
            }

            sqlQuery = `SELECT * FROM playerauditlogs WHERE player_id=${parseInt(result[0].id)} ORDER BY added_on DESC LIMIT ${limit}`;
            var dresult = await db.execute(sqlQuery);

            if (dresult.length === 0) {
                return res.status(200).json({ success: false, message: 'No history found' });
            }
            else{
                return res.status(200).json({ success: true, data: dresult });
            }
        } catch (error) {
            logger.error('Failed to get player history:', error);
            console.log('Failed to get player history:', error);
            return res.status(200).json({ success: false, message: 'Failed to get player history' });
        }
    }



    static async getClanHistory(req, res) {
        try {
            var { tag } = req.params; // get clan tag from URL
            if (tag === undefined) {
                return res.status(200).json({ success: false, message: 'Clan tag is required' });
            }
    
            const limit = parseInt(req.query.limit) || 10;
    
            tag = decodeURIComponent(tag);
    
            if (tag.startsWith('#')) {
                tag = tag.substring(1);
            }

            const checkTag = tag.startsWith('#') ? tag : `#${tag}`;
            const isValid = await clashService.isClanTagValid(checkTag);

            if (!isValid) {
                return res.status(200).json({ success: false, message: 'Invalid clan tag' });
            }

            var sqlQuery = 'SELECT id FROM clan WHERE clanTag = ?';
            var result = await db.execute(sqlQuery, [tag.toUpperCase()]);
    
            if (result.length === 0) {
                return res.status(200).json({ success: false, message: 'Clan not found' });
            } else {
                sqlQuery = `SELECT * FROM clanauditlogs WHERE clan_id=${parseInt(result[0].id)} AND event_type IN ('clanDescriptionChange', 'clanLevelChange', 'clanLocationChange', 'clanWarLogChange', 'clanNameChange', 'ADD') ORDER BY added_on DESC LIMIT ${limit}`;
                var dresult = await db.execute(sqlQuery);
    
                if (dresult.length === 0) {
                    return res.status(200).json({ success: false, message: 'No history found' });
                } else {
                    return res.status(200).json({ success: true, data: dresult });
                }
            }
        } catch (error) {
            logger.error('Failed to get clan history:', error);
            console.log('Failed to get clan history:', error);
            return res.status(200).json({ success: false, message: 'Failed to get clan history' });
        }
    }

    static async getClanRankingsFromLocation(req, res) {
        try {
            var { locationId } = req.params;
            if (!locationId) {
                return res.status(200).json({ success: false, message: 'Location ID is required' });
            }
            // check if limit is provided in query, if not set it to 10
            const limit = parseInt(req.query.limit) || 10;
            const data = await clashService.getClanRankingsFromALocation(locationId, limit);
            return res.status(200).json({ success: true, data: data });
        } catch (error) {
            if (error.status === 503 && error.reason === 'inMaintenance') {
                logger.error('Service is currently down for maintenance');
                return res.status(200).json({ success: false, message: 'API is currently in maintenance, please come back later' });
            }
            logger.error('Failed to get clan rankings from location:', error);
            console.log('Failed to get clan rankings from location:', error);
            return res.status(500).json({ success: false, message: 'Failed to get clan rankings from location' });
        }
    }



    static async getLocations(req, res) {
        try {
            const data = await clashService.getLocations();
            return res.status(200).json({ success: true, data: data });
        } catch (error) {
            if (error.status === 503 && error.reason === 'inMaintenance') {
                logger.error('Service is currently down for maintenance');
                return res.status(200).json({ success: false, message: 'API is currently in maintenance, please come back later' });
            }
            logger.error('Failed to get locations:', error);
            console.log('Failed to get locations:', error);
            return res.status(500).json({ success: false, message: 'Failed to get locations' });
        }
    }

    static async getPlayersRankingsFromLocation(req, res) {
        try {
            var { locationId } = req.params;
            if (!locationId) {
                return res.status(200).json({ success: false, message: 'Location ID is required' });
            }
            const limit = parseInt(req.query.limit) || 10;
            const data = await clashService.getPlayerRankingsFromALocation(locationId, limit);
            return res.status(200).json({ success: true, data: data });
        } catch (error) {
            if (error.status === 503 && error.reason === 'inMaintenance') {
                logger.error('Service is currently down for maintenance');
                return res.status(200).json({ success: false, message: 'API is currently in maintenance, please come back later' });
            }
            logger.error('Failed to get player rankings from location:', error);
            console.log('Failed to get player rankings from location:', error);
            return res.status(500).json({ success: false, message: 'Failed to get player rankings from location' });
        }
    }


    static async getClanMembersHistory(req, res) {
        try {
            var { tag } = req.params; // get clan tag from URL
            if (tag === undefined) {
                return res.status(200).json({ success: false, message: 'Clan tag is required' });
            }
    
            const limit = parseInt(req.query.limit) || 10;
    
            tag = decodeURIComponent(tag);
    
            if (tag.startsWith('#')) {
                tag = tag.substring(1);
            }

            const checkTag = tag.startsWith('#') ? tag : `#${tag}`;
            const isValid = await clashService.isClanTagValid(checkTag);

            if (!isValid) {
                return res.status(200).json({ success: false, message: 'Invalid clan tag' });
            }

            var sqlQuery = 'SELECT id FROM clan WHERE clanTag = ?';
            var result = await db.execute(sqlQuery, [tag.toUpperCase()]);
    
            if (result.length === 0) {
                return res.status(200).json({ success: false, message: 'Clan not found' });
            } else {
                sqlQuery = `SELECT * FROM clanauditlogs WHERE clan_id=${parseInt(result[0].id)} AND event_type IN ('clanMemberChange','clanMemberRoleChange') ORDER BY added_on DESC LIMIT ${limit}`;
                var dresult = await db.execute(sqlQuery);
    
                if (dresult.length === 0) {
                    return res.status(200).json({ success: false, message: 'No member history found' });
                } else {
                    return res.status(200).json({ success: true, data: dresult });
                }
            }
        } catch (error) {
            logger.error('Failed to get clan history:', error);
            console.log('Failed to get clan history:', error);
            return res.status(200).json({ success: false, message: 'Failed to get clan history' });
        }
    }
    

    static async getClanData(req, res) {
        try {
            var { tag } = req.params;
            if (!tag) {
                return res.status(200).json({ success: false, message: 'Clan tag is required' });
            }
            if (!clashService.isClanTagValid(tag.toUpperCase())) {
                return res.status(200).json({ success: false, message: 'Invalid clan tag' });
            }

            tag = decodeURIComponent(tag);

            if(tag.startsWith('#')) {
                tag = tag.substring(1);
            }
            var sqlQuery = 'SELECT * FROM clan WHERE clanTag = ?';
            var result = await db.execute(sqlQuery, [tag.toUpperCase()]);
            if(result.length === 0) {
                sqlQuery = 'INSERT INTO clan (clanTag, isToBeSynced, firstseen, lastsynced) VALUES (?, ?, ?, ?)';
                result = await db.execute(sqlQuery, [tag.toUpperCase(), 0, new Date(), new Date()]);
                if (result.length === 0) {
                    return res.status(200).json({ success: false, message: 'Failed to insert clan data' });
                }else{
                    sqlQuery = 'INSERT INTO clanauditlogs (clan_id, detailedData, event_type, added_on) VALUES (?, ?, ?, ?)';
                    result = await db.execute(sqlQuery, [result.insertId, 'Clan added to database', 'ADD', new Date()]);
                }

            }
            const data = await clashService.getClan(tag.toUpperCase());
            return res.status(200).json({ success: true, data: data });
        } catch (error) {
            if (error.status === 503 && error.reason === 'inMaintenance') {
                var { tag } = req.params;
                var sqlQuery = 'SELECT id FROM clan WHERE clanTag = ? AND isToBeSynced = 1';
                var result = await db.execute(sqlQuery, [tag.toUpperCase()]);
                if(result.length > 0) {
                    sqlQuery = 'SELECT clanJSON FROM currentclanobject WHERE clanid = ?';
                    result = await db.execute(sqlQuery, [result[0].id]);
                    if(result.length > 0) {
                        return res.status(200).json({ success: true, data:result[0].clanJSON });
                    }
                }
                logger.error('Service is currently down for maintenance');
                return res.status(200).json({ success: false, message: 'API is currently in maintenance, please come back later' });
            }
            if(error.reason === 'notFound') {
                return res.status(200).json({ success: false, message: 'Clan not found' });
            }
            logger.error('Failed to get clash data:', error);
            console.log('Failed to get clash data:', error);
            return res.status(500).json({ success: false, message: 'Failed to get clash data' });
        }
    }

    static async getWarWeight(req, res){
        try {
            var { tag } = req.params;
            if (!tag) {
                return res.status(200).json({ success: false, message: 'Clan tag is required' });
            }
            tag = decodeURIComponent(tag);

            const checkTag = tag.startsWith('#') ? tag : `#${tag}`;
            const isValid = await clashService.isClanTagValid(checkTag);

            if (!isValid) {
                return res.status(200).json({ success: false, message: 'Invalid clan tag' });
            }

            const data = await clashService.getWarWeight(tag.toUpperCase());
            return res.status(200).json({ success: true, data: data });
        } catch (error) {
            if (error.status === 503 && error.reason === 'inMaintenance') {
                logger.error('Service is currently down for maintenance');
                return res.status(200).json({ success: false, message: 'API is currently in maintenance, please come back later' });
            }
            if (error.reason === 'notFound') {
                return res.status(200).json({ success: false, message: 'Clan war log is private.' });
            }
            logger.error('Failed to get war weight:', error);
            return res.status(500).json({ success: false, message: 'Failed to get war weight' });
        }
    }
    
    static async getClanMembers(req, res) {
        try {
            const { tag } = req.params;
            if (!tag) {
                return res.status(200).json({ success: false, message: 'Clan tag is required' });
            }

            const checkTag = tag.startsWith('#') ? tag : `#${tag}`;
            const isValid = await clashService.isClanTagValid(checkTag);

            if (!isValid) {
                return res.status(200).json({ success: false, message: 'Invalid clan tag' });
            }

            const data = await clashService.getClanMembers(tag.toUpperCase());
            return res.status(200).json({ success: true, data: data });
        } catch (error) {
            if (error.status === 503 && error.reason === 'inMaintenance') {
                logger.error('Service is currently down for maintenance');
                return res.status(200).json({ success: false, message: 'API is currently in maintenance, please come back later' });
            }
            if (error.reason === 'notFound') {
                return res.status(200).json({ success: false, message: 'Clan war log is private.' });
            }
            logger.error('Failed to get clash members:', error);
            return res.status(500).json({ success: false, message: 'Failed to get clash members' });
        }
    }

    static async getClanMembersHero(req, res) {
        try {
            const { tag } = req.params;
            if (!tag) {
                return res.status(200).json({ success: false, message: 'Clan tag is required' });
            }

            const checkTag = tag.startsWith('#') ? tag : `#${tag}`;
            const isValid = await clashService.isClanTagValid(checkTag);

            if (!isValid) {
                return res.status(200).json({ success: false, message: 'Invalid clan tag' });
            }

            const data = await clashService.getClanMembersHero(tag.toUpperCase());
            return res.status(200).json({ success: true, data: data });
        } catch (error) {
            if (error.status === 503 && error.reason === 'inMaintenance') {
                logger.error('Service is currently down for maintenance');
                return res.status(200).json({ success: false, message: 'API is currently in maintenance, please come back later' });
            }
            logger.error('Failed to get clash members:', error);
            return res.status(500).json({ success: false, message: 'Failed to get clash members' });
        }
    }

    static async getPlayersInfo(req, res) {
        try {
            var { tag } = req.params;
            if (!tag) {
                return res.status(200).json({ success: false, message: 'Player tag is required' });
            }
            const checkTag = tag.startsWith('#') ? tag : `#${tag}`;
            const isValid = await clashService.isPlayerTagValid(checkTag);
            
            if (!isValid) {
                return res.status(200).json({ success: false, message: 'Invalid player tag' });
            }

            const data = await clashService.getPlayersInfo(tag.toUpperCase());
            return res.status(200).json({ success: true, data: data });
        } catch (error) {
            if (error.status === 503 && error.reason === 'inMaintenance') {
                var { tag } = req.params;
                logger.error('Service is currently down for maintenance');
                if(tag.startsWith('#')) {
                    tag = tag.substring(1);
                }
                var sqlQuery = 'SELECT id FROM player WHERE playerTag = ? AND isToBeTracked = 1';
                var result = await db.execute(sqlQuery, [tag.toUpperCase()]);
                if(result.length > 0) {
                    sqlQuery = 'SELECT playerJSON FROM currentplayerobject WHERE playerid = ?';
                    result = await db.execute(sqlQuery, [result[0].id]);
                    if(result.length > 0) {
                        return res.status(200).json({ success: true, data:result[0].clanJSON });
                    }
                }
                return res.status(200).json({ success: false, message: 'API is currently in maintenance, please come back later' });
            }
            if(error.reason === 'notFound' && error.status === 404) {
                return res.status(200).json({ success: false, message: 'Player not found' });
            }
            logger.error('Failed to get clash members:', error);
            return res.status(500).json({ success: false, message: 'Failed to get Player Info' });
        }
    }

    static async getCurrentWar(req, res) {
        try {
            const { tag } = req.params;
            if (!tag) {
                return res.status(200).json({ success: false, message: 'Clan tag is required' });
            }

            const checkTag = tag.startsWith('#') ? tag : `#${tag}`;
            const isValid = await clashService.isClanTagValid(checkTag);

            if (!isValid) {
                return res.status(200).json({ success: false, message: 'Invalid clan tag' });
            }


            const data = await clashService.getCurrentWar(tag.toUpperCase());
            return res.status(200).json({ success: true, data: data });

        } catch (error) {
            if (error.status === 503 && error.reason === 'inMaintenance') {
                logger.error('Service is currently down for maintenance');
                return res.status(200).json({ success: false, message: 'API is currently in maintenance, please come back later' });
            }
            if (error.reason === 'notFound') {
                return res.status(200).json({ success: false, message: 'Access denied, clan war log is private.' });
            }
            if(error.reason === 'privateWarLog') {
                return res.status(200).json({ success: false, message: 'Clan war log is private.' });
            }
            logger.error('Failed to get current war:' + error.reason);
            return res.status(500).json({ success: false, message: 'Failed to get current war' });
        }
    }
    
    static async getCapitalRaidSeasons(req, res) {
        try {
            var { tag } = req.params;

            if (!tag) {
            return res.status(200).json({ success: false, message: 'Clan tag is required' });
            }

            const checkTag = tag.startsWith('#') ? tag : `#${tag}`;
            const isValid = await clashService.isClanTagValid(checkTag);

            if (!isValid) {
                return res.status(200).json({ success: false, message: 'Invalid clan tag' });
            }

            const data = await clashService.getCapitalRaidSeasons(tag.toUpperCase());

            if(data.length === 0) {
                return res.status(200).json({ success: false, message: 'No capital raid seasons found' });
            }

            return res.status(200).json({ success: true, data: data });

        } catch (error) {
            if (error.status === 503 && error.reason === 'inMaintenance') {
                logger.error('Service is currently down for maintenance');
                return res.status(200).json({ success: false, message: 'API is currently in maintenance, please come back later' });
            }
            if(error.reason === 'notFound') {
                return res.status(200).json({ success: false, message: 'Access denied, clan war log is private.'});
            }
            logger.error('Failed to get capital raid seasons:', error);
            return res.status(500).json({ success: false, message: 'Failed to get capital raid seasons' });
        }
    }

    static async getClanWarLog(req, res) {
        try {
            var { tag } = req.params;
            if(!tag) {
                return res.status(200).json({ success: false, message: 'Clan tag is required' });
            }
            const checkTag = tag.startsWith('#') ? tag : `#${tag}`;
            const isValid = await clashService.isClanTagValid(checkTag);

            if (!isValid) {
                return res.status(200).json({ success: false, message: 'Invalid clan tag' });
            }

            const data = await clashService.getClanWarLog(tag.toUpperCase());
            return res.status(200).json({ success: true, data: data });
        } catch (error) {
            if (error.status === 503 && error.reason === 'inMaintenance') {
                logger.error('Service is currently down for maintenance');
                return res.status(200).json({ success: false, message: 'API is currently in maintenance, please come back later' });
            }
            if(error.reason === 'privateWarLog') {
                return res.status(200).json({ success: false, message: 'Clan war log is private.' });
            }
            if(error.reason === 'notFound') {
                return res.status(200).json({ success: false, message: 'Clan war log not found.' });
            }
            console.log('Failed to get clan war log:', error);
            return res.status(500).json({ success: false, message: 'Failed to get clan war log' });
        }
    }

    static async getTHLevels(req, res) {
        try {
            var { tag } = req.params;
            if(!tag) {
                return res.status(200).json({ success: false, message: 'Clan tag is required' });
            }
            
            const checkTag = tag.startsWith('#') ? tag : `#${tag}`;
            const isValid = await clashService.isClanTagValid(checkTag);

            if (!isValid) {
                return res.status(200).json({ success: false, message: 'Invalid clan tag' });
            }

            const data = await clashService.getTHLevels(tag.toUpperCase());
            return res.status(200).json({ success: true, data: data });
        } catch (error) {
            if (error.status === 503 && error.reason === 'inMaintenance') {
                logger.error('Service is currently down for maintenance');
                return res.status(200).json({ success: false, message: 'API is currently in maintenance, please come back later' });
            }
            console.log('Failed to get TH levels:', error);
            logger.error('Failed to get TH levels:', error);
            return res.status(500).json({ success: false, message: 'Failed to get TH levels' });
        }
    }

    static async getCWLresults(req, res) {
        try {
            var { tag } = req.params;
            if (!tag) {
                return res.status(200).json({ success: false, message: 'Clan tag is required' });
            }
            const checkTag = tag.startsWith('#') ? tag : `#${tag}`;
            const isValid = await clashService.isClanTagValid(checkTag);

            if (!isValid) {
                return res.status(200).json({ success: false, message: 'Invalid clan tag' });
            }
            const data = await clashService.getCWLresults(tag.toUpperCase());
            return res.status(200).json({ success: true, data: data });
        } catch (error) {
            if (error.status === 503 && error.reason === 'inMaintenance') {
                logger.error('Service is currently down for maintenance');
                return res.status(200).json({ success: false, message: 'API is currently in maintenance, please come back later' });
            }
            if (error.reason === 'notFound') {
                return res.status(200).json({ success: false, message: 'Clan is not in CWL' });
            }
            logger.error('Failed to get CWL results:', error);
            return res.status(500).json({ success: false, message: 'Failed to get CWL results' });
        }
    }
}

module.exports = ClashController;
