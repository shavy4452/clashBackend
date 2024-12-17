const clashService = require('../services/clashService');
const logger = require('../utils/logger.js');
const chalk = require('chalk');
const db = require('../services/mysqldbService.js');

class ClashController {

    static async getClansByLeague(req, res) {
        try {
            const { league } = req.params;
            if (!league) {
                return res.status(200).json({ success: false, message: 'League is required' });
            }
            const acceptableLeagues = ['1945', '1945_FD', 'GFL', 'BZLM', 'None', 'BL_FWL', 'BL_CROSS', 'BL_GFL', 'FWA', 'BL_FWA', 'FORMER']
            if (!acceptableLeagues.includes(league)) {
                return res.status(200).json({ success: false, message: 'Invalid league' });
            }

            var sqlQuery = 'SELECT * FROM leagueinfo WHERE majorLeagueInfo = ? OR minorLeagueInfo = ?';
            var result = await db.execute(sqlQuery, [league, league]);
            if (result.length === 0) {
                return res.status(200).json({ success: false, message: 'No clans found in the league' });
            }
            var data = [];
            for (var i = 0; i < result.length; i++) {
                var clan = {};
                sqlQuery = 'SELECT clanJSON FROM currentclanobject WHERE clanid = ?';
                var clanData = await db.execute(sqlQuery, [result[i].clan_id]);
                if (clanData.length > 0) {
                    clan.name = clanData[0].clanJSON.name;
                    clan.tag = clanData[0].clanJSON.tag;
                    clan.type = clanData[0].clanJSON.type;
                    clan.description = clanData[0].clanJSON.description;
                    clan.members = clanData[0].clanJSON.members;
                    data.push(clan);
                }
            }
            return res.status(200).json({ success: true, data: data });
        } catch (error) {
            logger.error('Failed to get clans by league:' +  error);
            return res.status(200).json({ success: false, message: 'Failed to get clans by league' });
        }
    }

    static async getPlayerStatus(req, res) {
        const { tag } = req.params;
        if (!tag) {
            return res.status(200).json({ success: false, message: 'Player tag is required' });
        }
        var message = {};
        try {
            const checkTag = tag.startsWith('#') ? tag : `#${tag}`;
            const isValid = await clashService.isPlayerTagValid(checkTag);

            if (!isValid) {
                return res.status(200).json({ success: false, message: 'Invalid player tag' });
            }

            var sqlQuery = 'SELECT id, isToBeTracked FROM player WHERE playerTag = ?';
            var result1 = await db.execute(sqlQuery, [tag.toUpperCase()]);
            if (result1.length === 0) {
                return res.status(200).json({ success: true, status: 'none', playerNotes: [] });
            }

            sqlQuery = 'SELECT status, mapped_note_id FROM playercurrentstatus WHERE playerTag = ?';
            var result = await db.execute(sqlQuery, [tag.toUpperCase()]);
            if (result.length === 0) {
                return res.status(200).json({ success: true, status: 'none', playerNotes: [] });
            }

            sqlQuery = 'SELECT * FROM playernotes WHERE player_id = ? ';
            var notes = await db.execute(sqlQuery, [result1[0].id]);
            var playerNotes = [];
            for (var i = 0; i < notes.length; i++) {
                var note = {
                    note_type: notes[i].note_type,
                    note_detail: notes[i].note_detail,
                    note_added_by: notes[i].note_added_by,
                    note_added_on: notes[i].note_added_on,
                    is_note_active: notes[i].is_note_active
                };
                playerNotes.push(note);
            }


            return res.status(200).json({ success: true, status: result[0].status, playerNotes: playerNotes });

        } catch (error) {
            logger.error('Failed to get player status:', error);
            return res.status(200).json({ success: false, message: 'Failed to get player status' });
        }
    }

    static async getTrackedClanWars(req, res) {
        try {
            const { tag } = req.params;
            if (!tag) {
                return res.status(200).json({ success: false, message: 'Clan Tag is required' });
            }

            const checkTag = tag.startsWith('#') ? tag : `#${tag}`;
            const isValid = await clashService.isClanTagValid(checkTag);

            if (!isValid) {
                return res.status(200).json({ success: false, message: 'Invalid clan tag' });
            }

            let decodedTag = decodeURIComponent(tag).startsWith('#') ? tag.substring(1) : tag;
            decodedTag = decodedTag.toUpperCase();

            let sqlQuery = `SELECT 
            wl.id, 
            wl.clan_id, 
            wl.startTime, 
            wl.endTime, 
            wl.opponentClanTag, 
            wl.oppoentClanName, 
            wl.opponentLeagueDuringWar, 
            wl.clanStars, 
            wl.opponentStars, 
            wl.trackedState, 
            wl.added_on,
            li.majorLeagueInfo,
            li.minorLeagueInfo,
            JSON_EXTRACT(wl.warLogJSON, '$.clan.attacks') AS clanAttacks,
            JSON_EXTRACT(wl.warLogJSON, '$.clan.stars') AS clanStars,
            JSON_EXTRACT(wl.warLogJSON, '$.clan.destructionPercentage') AS clanDestructionPercentage,
            JSON_EXTRACT(wl.warLogJSON, '$.opponent.attacks') AS opponentAttacks,
            JSON_EXTRACT(wl.warLogJSON, '$.opponent.stars') AS opponentStars,
            JSON_EXTRACT(wl.warLogJSON, '$.opponent.destructionPercentage') AS opponentDestructionPercentage,
            CASE 
                WHEN wl.trackedState = 'warEnded' THEN 
                    CASE 
                        -- Compare stars first
                        WHEN JSON_EXTRACT(wl.warLogJSON, '$.clan.stars') > JSON_EXTRACT(wl.warLogJSON, '$.opponent.stars') THEN 'Clan Wins'
                        WHEN JSON_EXTRACT(wl.warLogJSON, '$.clan.stars') < JSON_EXTRACT(wl.warLogJSON, '$.opponent.stars') THEN 'Opponent Wins'
                        -- If stars are equal, compare destruction percentage
                        WHEN JSON_EXTRACT(wl.warLogJSON, '$.clan.destructionPercentage') > JSON_EXTRACT(wl.warLogJSON, '$.opponent.destructionPercentage') THEN 'Clan Wins'
                        WHEN JSON_EXTRACT(wl.warLogJSON, '$.clan.destructionPercentage') < JSON_EXTRACT(wl.warLogJSON, '$.opponent.destructionPercentage') THEN 'Opponent Wins'
                        -- If destruction percentage is also equal, compare attacks
                        WHEN JSON_EXTRACT(wl.warLogJSON, '$.clan.attacks') < JSON_EXTRACT(wl.warLogJSON, '$.opponent.attacks') THEN 'Clan Wins'
                        WHEN JSON_EXTRACT(wl.warLogJSON, '$.clan.attacks') > JSON_EXTRACT(wl.warLogJSON, '$.opponent.attacks') THEN 'Opponent Wins'
                        ELSE 'Draw'
                    END
                ELSE 'Ongoing'
            END AS winner
        FROM 
            warlogrecords wl
        LEFT JOIN 
            leagueinfo li ON wl.clan_id = li.clan_id
        WHERE 
            wl.clan_id = (SELECT id FROM clan WHERE clanTag = ?)
        ORDER BY 
            wl.added_on DESC;`;
            let result = await db.execute(sqlQuery, [decodedTag]);

            if (result.length === 0) {
                return res.status(200).json({ success: false, message: 'No tracked wars found' });
            }
            return res.status(200).json({ success: true, data: result });
            
        } catch (error) {
            logger.error('Failed to get tracked wars:', error);
            return res.status(200).json({ success: false, message: 'Failed to get tracked wars' });
        }   
    }

    static async addPlayerNotes(req, res) {
        const { tag } = req.params;
        const { note_type, note_detail } = req.body;
        var { note_added_by } = req.user_name;

        const requiredFields = [
            { value: tag, message: 'Player tag is required' },
            { value: note_type, message: 'Note type is required' },
            { value: note_detail, message: 'Note detail is required' },
        ];

        if (!note_added_by){
            note_added_by = 'SYSTEM';
        }
        
        for (const field of requiredFields) {
            if (!field.value) {
                return res.status(200).json({ success: false, message: field.message });
            }
        }

        const acceptable_note_types = ['info', 'warning', 'ban', 'clear'];
        if (!acceptable_note_types.includes(note_type)) {
            return res.status(200).json({ success: false, message: 'Invalid note type' });
        }

        try {
            const checkTag = tag.startsWith('#') ? tag : `#${tag}`;
            const isValid = await clashService.isPlayerTagValid(checkTag);

            if (!isValid) {
                return res.status(200).json({ success: false, message: 'Invalid player tag' });
            }

            let decodedTag = decodeURIComponent(tag).startsWith('#') ? tag.substring(1) : tag;
            decodedTag = decodedTag.toUpperCase();

            let sqlQuery = 'SELECT id, isToBeTracked FROM player WHERE playerTag = ?';
            let result = await db.execute(sqlQuery, [decodedTag]);

            if (result.length === 0) {
                return res.status(200).json({ success: false, message: 'Player not found in database' });
            }
            
            sqlQuery = 'INSERT INTO playernotes (player_id, note_type, note_detail, note_added_by, note_added_on, is_note_active) VALUES (?, ?, ?, ?, ?, ?)';
            var note_id = await db.execute(sqlQuery, [result[0].id, note_type, note_detail, note_added_by, new Date(), 1]);

            var status = '';

            if (note_type === 'info'){
                status = 'STAFF';
            }else if (note_type === 'warning'){
                status = 'WARNING';
            }else if (note_type === 'ban'){
                status = 'BANNED';
            }else if (note_type === 'clear'){
                status = 'NONE';
            }

            sqlQuery = 'SELECT id from playercurrentstatus WHERE playerTag = ?';
            var _result = await db.execute(sqlQuery, [decodedTag]);
            
            if (_result.length === 0) {
                sqlQuery = 'INSERT INTO playercurrentstatus (playerTag, status, mapped_note_id, added_on, updated_on) VALUES (?, ?, ?, ?, ?)';
                await db.execute(sqlQuery, [decodedTag, status, note_id.insertId, new Date(), new Date()]);
            }else{
                sqlQuery = 'UPDATE playercurrentstatus SET status = ?, updated_on = ? WHERE playerTag = ?';
                await db.execute(sqlQuery, [status, new Date(), decodedTag]);
            }
            if (result[0].isToBeTracked === 0) {
                sqlQuery = 'UPDATE player SET isToBeTracked = 1 WHERE id = ?';
                await db.execute(sqlQuery, [result[0].id]);
            }

            return res.status(200).json({ success: true, message: 'Player notes added successfully' });
        }catch(error){
            logger.error('Failed to add player notes:', error);
            console.log('Failed to add player notes:', error);
            return res.status(200).json({ success: false, message: 'Failed to add player notes' });
        }

    }

    static async addClanAssociation(req, res) {
        const { tag } = req.params;
        const { majorLeagueInfo, minorLeagueInfo, publicNote, internalNote } = req.body;

        if (!tag) {
            return res.status(200).json({ success: false, message: 'Clan tag is required' });
        }
        if (!majorLeagueInfo) {
            return res.status(200).json({ success: false, message: 'Major League is required' });
        }

        const majorLeague = majorLeagueInfo || "";
        const minorLeague = minorLeagueInfo || "";
        const publicNoteText = publicNote || "";
        const internalNoteText = internalNote || "";

        const acceptableLeagues = ['1945', '1945_FD', 'GFL', 'BZLM', 'None', 'BL_FWL', 'BL_CROSS', 'BL_GFL', 'FWA', 'BL_FWA', 'FORMER']

        if (majorLeague && !acceptableLeagues.includes(majorLeague)) {
            return res.status(200).json({ success: false, message: 'Invalid Major League' });
        }

        if (minorLeague && !acceptableLeagues.includes(minorLeague)) {
            return res.status(200).json({ success: false, message: 'Invalid Minor League' });
        }

        try{
            const checkTag = tag.startsWith('#') ? tag : `#${tag}`;
            const isValid = await clashService.isClanTagValid(checkTag);
    
            if (!isValid) {
                return res.status(200).json({ success: false, message: 'Invalid clan tag' });
            }
    
            let decodedTag = decodeURIComponent(tag).startsWith('#') ? tag.substring(1) : tag;
            decodedTag = decodedTag.toUpperCase();
    
            let sqlQuery = 'SELECT id, isToBeSynced FROM clan WHERE clanTag = ?';
            let result = await db.execute(sqlQuery, [decodedTag]);
    
            if (result.length === 0) {
                return res.status(200).json({ success: false, message: 'Clan not found in database, are you trying to automate?' });
            }

            sqlQuery = 'SELECT * FROM leagueinfo WHERE clan_id = ?';

            let leagueData = await db.execute(sqlQuery, [result[0].id]);
            var updateMessage = '';
            var { user } = req.user_name;
            if (!user){
                user = 'SYSTEM';
            }

            if (leagueData.length === 0){
                sqlQuery = 'INSERT INTO leagueinfo (clan_id, majorLeagueInfo, minorLeagueInfo, publicNote, internalNote, last_updated) VALUES (?, ?, ?, ?, ?, ?)';
                updateMessage = `${user} added the clan's association details with Major League: ${majorLeague}, Minor League: ${minorLeague}, Public Note: ${publicNoteText}, Internal Note: ${internalNoteText}`;
                await db.execute(sqlQuery, [result[0].id, majorLeague, minorLeague, publicNoteText, internalNoteText, new Date()]);
            }
            else{
                sqlQuery = 'UPDATE leagueinfo SET majorLeagueInfo = ?, minorLeagueInfo = ?, publicNote = ?, internalNote = ?, last_updated = ? WHERE clan_id = ?';
                updateMessage = `${user} changed the clan's association details from Major League: ${leagueData[0].majorLeagueInfo}, Minor League: ${leagueData[0].minorLeagueInfo}, Public Note: ${leagueData[0].publicNote}, Internal Note: ${leagueData[0].internalNote} to Major League: ${majorLeague}, Minor League: ${minorLeague}, Public Note: ${publicNoteText}, Internal Note: ${internalNoteText}`;
                await db.execute(sqlQuery, [majorLeague, minorLeague, publicNoteText, internalNoteText, new Date(), result[0].id]);
            }

            if (result[0].isToBeSynced === 0) {
                sqlQuery = 'UPDATE clan SET isToBeSynced = 1 WHERE id = ?';
                await db.execute(sqlQuery, [result[0].id]);
            }

            sqlQuery = 'INSERT INTO clanauditlogs (clan_id, detailedData, event_type, added_on) VALUES (?, ?, ?, ?)';
            await db.execute(sqlQuery, [result[0].id, updateMessage, 'UPDATE', new Date()]);

            return res.status(200).json({ success: true, message: 'Clan association updated successfully' });

        }catch(error){
            logger.error('Failed to add clan association:', error);
            console.log('Failed to add clan association:', error);
            return res.status(200).json({ success: false, message: 'Failed to add clan association' });
        }
    }

    static async getClanAssociation(req, res) {
        let returnData = {};
        const { tag } = req.params;
    
        if (!tag) {
            return res.status(200).json({ success: false, message: 'Clan tag is required' });
        }
    
        try {
            const checkTag = tag.startsWith('#') ? tag : `#${tag}`;
            const isValid = await clashService.isClanTagValid(checkTag);
    
            if (!isValid) {
                return res.status(200).json({ success: false, message: 'Invalid clan tag' });
            }
    
            let decodedTag = decodeURIComponent(tag).startsWith('#') ? tag.substring(1) : tag;
            decodedTag = decodedTag.toUpperCase();
    
            let sqlQuery = 'SELECT id, isToBeSynced FROM clan WHERE clanTag = ?';
            let result = await db.execute(sqlQuery, [decodedTag]);
    
            if (result.length === 0) {
                // Insert the clan if not found
                sqlQuery = 'INSERT INTO clan (clanTag, isToBeSynced, firstseen, lastsynced) VALUES (?, ?, ?, ?)';
                result = await db.execute(sqlQuery, [decodedTag, 0, new Date(), new Date()]);
    
                if (result.affectedRows === 0) {
                    return res.status(200).json({ success: false, message: 'Failed to insert clan data' });
                }
    
                await db.execute('INSERT INTO clanauditlogs (clan_id, detailedData, event_type, added_on) VALUES (?, ?, ?, ?)', [
                    result.insertId, 'Clan added to database', 'ADD', new Date()
                ]);
    
                returnData = {
                    clan_id: result.insertId,
                    majorLeagueInfo: 'No League Association',
                    minorLeagueInfo: 'No League Association',
                    publicNote: '',
                    internalNote: '',
                    last_updated: new Date(),
                    isSynced: 0
                };
                return res.status(200).json({ success: true, data: returnData });
            }
    
            sqlQuery = 'SELECT * FROM leagueinfo WHERE clan_id = ?';
            const leagueData = await db.execute(sqlQuery, [result[0].id]);
    
            if (leagueData.length === 0) {
                returnData = {
                    clan_id: result[0].id,
                    majorLeagueInfo: 'No League Association',
                    minorLeagueInfo: 'No League Association',
                    publicNote: '',
                    internalNote: '',
                    last_updated: new Date(),
                    isSynced: result[0].isToBeSynced
                };
            } else {
                // Return league info from the database
                returnData = {
                    clan_id: result[0].id,
                    majorLeagueInfo: leagueData[0].majorLeagueInfo,
                    minorLeagueInfo: leagueData[0].minorLeagueInfo,
                    publicNote: leagueData[0].publicNote,
                    internalNote: leagueData[0].internalNote,
                    last_updated: leagueData[0].last_updated,
                    isSynced: result[0].isToBeSynced
                };
            }
    
            return res.status(200).json({ success: true, data: returnData });
    
        } catch (error) {
            logger.error('Failed to get clan association:', error);
            return res.status(200).json({ success: false, message: 'Failed to get clan association' });
        }
    }


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
                sqlQuery = `SELECT * FROM clanauditlogs WHERE clan_id=${parseInt(result[0].id)} AND event_type IN ('clanDescriptionChange', 'clanLevelChange', 'clanLocationChange', 'clanWarLogChange', 'clanNameChange', 'ADD', 'UPDATE') ORDER BY added_on DESC LIMIT ${limit}`;
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
            return res.status(200).json({ success: false, message: 'Failed to get clan rankings from location' });
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
            return res.status(200).json({ success: false, message: 'Failed to get locations' });
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
            return res.status(200).json({ success: false, message: 'Failed to get player rankings from location' });
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
            let { tag } = req.params;
    
            if (!tag) {
                return res.status(200).json({ success: false, message: 'Clan tag is required' });
            }
    
            tag = decodeURIComponent(tag).toUpperCase();
            if (!clashService.isClanTagValid(tag)) {
                return res.status(200).json({ success: false, message: 'Invalid clan tag' });
            }
    
            if (tag.startsWith('#')) {
                tag = tag.substring(1);
            }
            const clanResult = await db.execute('SELECT * FROM clan WHERE clanTag = ?', [tag]);
    
            let clanId;
            let associationInfo = { 
                majorLeagueInfo: 'No League Association', 
                minorLeagueInfo: 'No League Association', 
                publicNote: '', 
                internalNote: '' 
            };
    
            if (clanResult.length === 0) {
                // Clan not found, insert it
                if(clashService.isClanTagValid(tag)){
                    const insertClanResult = await db.execute(
                        'INSERT INTO clan (clanTag, isToBeSynced, firstseen, lastsynced) VALUES (?, ?, ?, ?)',
                        [tag, 0, new Date(), new Date()]
                    );
                    clanId = insertClanResult.insertId;
        
                    // Add an audit log
                    await db.execute(
                        'INSERT INTO clanauditlogs (clan_id, detailedData, event_type, added_on) VALUES (?, ?, ?, ?)',
                        [clanId, 'Clan added to database', 'ADD', new Date()]
                    );
                }else{
                    return res.status(200).json({ success: false, message: 'Invalid clan tag' });
                }
            } else {
                // Clan found, fetch additional association info
                clanId = clanResult[0].id;
                const leagueInfo = await db.execute('SELECT * FROM leagueinfo WHERE clan_id = ?', [clanId]);
                if (leagueInfo.length > 0) {
                    associationInfo = leagueInfo[0];
                }
            }
    
            // Fetch live clan data
            const clanData = await clashService.getClan(tag);
    
            // Update members with their statuses
            if (clanData.memberCount > 0) {
                const playerTags = clanData.members.map(member => member.tag.substring(1));
                const placeholders = playerTags.map(() => '?').join(',');
                const playerStatusQuery = `SELECT playerTag, status FROM playercurrentstatus WHERE playerTag IN (${placeholders})`;
                const playerStatuses = await db.execute(playerStatusQuery, playerTags);
    
                clanData.members.forEach(member => {
                    const statusEntry = playerStatuses.find(status => status.playerTag === member.tag.substring(1));
                    member.status = statusEntry ? statusEntry.status : 'NONE';
                });
            }
    
            // Attach association info
            clanData.associationInfo = associationInfo;
    
            return res.status(200).json({ success: true, data: clanData });
        } catch (error) {
            // Maintenance mode handling
            if (error.status === 503 && error.reason === 'inMaintenance') {
                logger.error('Service is currently down for maintenance');
                const { tag } = req.params;
    
                const maintenanceResult = await db.execute('SELECT id FROM clan WHERE clanTag = ? AND isToBeSynced = 1', [tag.toUpperCase()]);
                if (maintenanceResult.length > 0) {
                    const clanJSONResult = await db.execute('SELECT clanJSON FROM currentclanobject WHERE clanid = ?', [maintenanceResult[0].id]);
                    if (clanJSONResult.length > 0) {
                        const leagueInfoResult = await db.execute('SELECT * FROM leagueinfo WHERE clan_id = ?', [maintenanceResult[0].id]);
                        const leagueInfo = leagueInfoResult.length > 0 ? leagueInfoResult[0] : {
                            majorLeagueInfo: 'No League Association',
                            minorLeagueInfo: 'No League Association',
                            publicNote: '',
                            internalNote: ''
                        };
                        clanJSONResult[0].clanJSON.associationInfo = leagueInfo;
                        return res.status(200).json({ success: true, data: clanJSONResult[0].clanJSON });
                    }
                }
                return res.status(200).json({ success: false, message: 'API is currently in maintenance, please come back later' });
            }
    
            // Clan not found
            if (error.reason === 'notFound') {
                return res.status(200).json({ success: false, message: 'Clan not found' });
            }
    
            // Log and return generic error
            logger.error('Failed to get clash data:', error);
            console.error('Failed to get clash data:', error);
            return res.status(200).json({ success: false, message: 'Failed to get clash data' });
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
            return res.status(200).json({ success: false, message: 'Failed to get war weight' });
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
            return res.status(200).json({ success: false, message: 'Failed to get clash members' });
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
            return res.status(200).json({ success: false, message: 'Failed to get clash members' });
        }
    }

    static async getPlayersInfo(req, res) {
        try {
            var { tag } = req.params;
            if (!tag) {
                return res.status(200).json({ success: false, message: 'Player tag is required' });
            }
    
            const checkTag = tag.startsWith('#') ? tag : `#${tag}`;
            const isValid = await clashService.isPlayerTagValid(checkTag.toUpperCase());
            if (!isValid) {
                return res.status(200).json({ success: false, message: 'Invalid player tag' });
            }
    
            const playerTagUpperCase = tag.toUpperCase();
            const data = await clashService.getPlayersInfo(playerTagUpperCase);
    
            if (tag.startsWith('#')) {
                tag = tag.substring(1);
            }
    
            // Check if the player exists and fetch necessary data
            const playerResult = await db.execute('SELECT id FROM player WHERE playerTag = ?', [playerTagUpperCase]);
    
            let playerId;
            if (playerResult.length === 0) {
                // Insert the player if not found
                const insertPlayerResult = await db.execute(
                    'INSERT INTO player (playerTag, isToBeTracked, firstseen, lastsynced) VALUES (?, ?, ?, ?)',
                    [playerTagUpperCase, 0, new Date(), new Date()]
                );
                playerId = insertPlayerResult.insertId;
    
                // Add an audit log
                await db.execute(
                    'INSERT INTO playerauditlogs (player_id, detailedData, event_type, added_on) VALUES (?, ?, ?, ?)',
                    [playerId, 'Player added to database', 'ADD', new Date()]
                );
            } else {
                playerId = playerResult[0].id;
            }
    
            // Fetch current player status and notes
            const [currentStatusResult, notesResult] = await Promise.all([
                db.execute('SELECT * from playercurrentstatus WHERE playerTag = ?', [playerTagUpperCase]),
                db.execute('SELECT * from playernotes WHERE player_id = ?', [playerId])
            ]);
    
            // Set player status
            const status = currentStatusResult.length > 0 ? currentStatusResult[0].status : 'NONE';
            data.status = status;
    
            // Attach player notes (if any)
            data.notes = notesResult.length > 0 ? notesResult : [];
    
            return res.status(200).json({ success: true, data });
        } catch (error) {
            if (error.status === 503 && error.reason === 'inMaintenance') {
                const { tag } = req.params;
                logger.error('Service is currently down for maintenance');
    
                // Check if player is to be tracked
                const playerResult = await db.execute('SELECT id FROM player WHERE playerTag = ? AND isToBeTracked = 1', [tag.toUpperCase()]);
                if (playerResult.length > 0) {
                    const playerInfo = await db.execute('SELECT playerJSON FROM currentplayerobject WHERE playerid = ?', [playerResult[0].id]);
                    if (playerInfo.length > 0) {
                        return res.status(200).json({ success: true, data: playerInfo[0].clanJSON });
                    }
                }
                return res.status(200).json({ success: false, message: 'API is currently in maintenance, please come back later' });
            }
    
            if (error.reason === 'notFound' && error.status === 404) {
                return res.status(200).json({ success: false, message: 'Player not found' });
            }
    
            logger.error('Failed to get Player Info:', error);
            console.log('Failed to get Player Info:', error);
            return res.status(200).json({ success: false, message: 'Failed to get Player Info' });
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
            return res.status(200).json({ success: false, message: 'Failed to get current war' });
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
            return res.status(200).json({ success: false, message: 'Failed to get capital raid seasons' });
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
            const getCurrentWarDetails = await clashService.getCurrentWar(tag.toUpperCase());
            if(getCurrentWarDetails && getCurrentWarDetails.state !== 'warEnded') {
                var currentWar = {};
                currentWar.result = 'inProgress';
                currentWar.endTime = getCurrentWarDetails.endTime;
                currentWar.teamSize = getCurrentWarDetails.teamSize;
                currentWar.attacksPerMember = getCurrentWarDetails.attacksPerMember;
                currentWar.clan = getCurrentWarDetails.clan
                delete currentWar.clan.members;
                currentWar.opponent = getCurrentWarDetails.opponent;     
                delete currentWar.opponent.members;           
            }
            const data = await clashService.getClanWarLog(tag.toUpperCase());
            if(typeof data !== 'string' && data.length > 0) {
                if(currentWar) {
                    data.unshift(currentWar);
                }
                const opponentTags = data.map(war => war.opponent.tag.replace('#', ''));
                opponentTags.push(tag.toUpperCase().replace('#', ''));
                if (opponentTags.length > 0) {
                    const placeholders = opponentTags.map(() => '?').join(',');
                    const query = `
                        SELECT 
                            c.clanTag, 
                            c.id AS clanId,
                            li.majorLeagueInfo,
                            li.minorLeagueInfo,
                            li.publicNote,
                            li.internalNote
                        FROM 
                            clan c
                        LEFT JOIN 
                            leagueinfo li ON c.id = li.clan_id
                        WHERE 
                            c.clanTag IN (${placeholders});
                    `;
                    const results = await db.execute(query, opponentTags);

                    const opponentMap = new Map();
                    let leagueInfo = null;

                    results.forEach(row => {
                        if (row.clanTag) {
                            opponentMap.set(row.clanTag, row);
                        }
                        if (row.clanTag === tag.toUpperCase().replace('#', '')) {
                            leagueInfo = row;
                        }
                    });

                    data.forEach(war => {
                        const opponentTag = war.opponent.tag.replace('#', '');
                        const opponent = opponentMap.get(opponentTag);
                        war.opponent.leagueInfo = opponent
                            ? {
                                majorLeagueInfo: opponent.majorLeagueInfo || 'No League Association',
                                minorLeagueInfo: opponent.minorLeagueInfo || 'No League Association',
                                publicNote: opponent.publicNote || '',
                                internalNote: opponent.internalNote || ''
                            }
                            : {
                                majorLeagueInfo: 'No League Association',
                                minorLeagueInfo: 'No League Association',
                                publicNote: '',
                                internalNote: ''
                            };

                        war.clan.leagueInfo = leagueInfo
                        
                    });
                }
            }

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
            return res.status(200).json({ success: false, message: 'Failed to get clan war log' });
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
            return res.status(200).json({ success: false, message: 'Failed to get TH levels' });
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
            return res.status(200).json({ success: false, message: 'Failed to get CWL results' });
        }
    }
}

module.exports = ClashController;
