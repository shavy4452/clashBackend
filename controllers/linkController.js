const MongoService = require('../services/mongoService');
const logger = require('../utils/logger');
const config = require('../config/config');
const clashService = require('../services/clashService');

class LinkController {
    static async getRecords(req, res) {
        try {
            var { phoneNumber } = req.params;
            if (!phoneNumber) {
                return res.status(200).json({ success: false, message: 'Phone number is required' });
            }
            var ClanRecord, PlayerRecord = [];
            await MongoService.connect();
            var ClanRecords = await MongoService.findOne(config.mongoDB.clanDB, {id:phoneNumber});
            var PlayerRecords = await MongoService.findOne(config.mongoDB.playerDB, {id:phoneNumber});
            if (!ClanRecords && !PlayerRecords) {
                return res.status(200).json({ success: false, message: 'No records found' });
            }
            if (ClanRecords && ClanRecords.Ctag && ClanRecords.Ctag.length > 0) {
                ClanRecord = ClanRecords.Ctag.split(" ");
            }else{
                ClanRecord = [];
            }
            if (PlayerRecords && PlayerRecords.Ptag && PlayerRecords.Ptag.length > 0) {
                PlayerRecords = PlayerRecords.Ptag.split(" ");
            }else{
                PlayerRecords = [];
            }
            let records = {
                ClanRecord,
                PlayerRecord
            }
            await MongoService.disconnect();
            return res.status(200).json({ success: true, data: records });
        } catch (error) {
            logger.error('Failed to get records:', error);
            console.log('error:', error);
            await MongoService.disconnect();
            return res.status(500).json({ success: false, message: 'Failed to get records' });
        }
    }

    static async addRecord(req, res) {
        try{
            const { PhoneNumber, Type, Tag: rawTag, Action } = req.params;
            const missingFields = [];
            
            if (!PhoneNumber) missingFields.push('PhoneNumber');
            if (!Type) missingFields.push('Type');
            if (!rawTag) missingFields.push('Tag');
            if (!Action) missingFields.push('Action');

            if (missingFields.length > 0) {
                return res.status(200).json({ success: false, message: `Missing ${missingFields.join(', ')}` });
            }

            if (!['add', 'remove'].includes(Action)) {
                return res.status(200).json({ success: false, message: 'Invalid Action' });
            }
            if (!['clan', 'player'].includes(Type)) {
                return res.status(200).json({ success: false, message: 'Invalid Type' });
            }

            let Tag = rawTag.startsWith('#') ? rawTag : `#${rawTag}`;
            Tag.toUpperCase();

            if (!clashService.isClanTagValid(Tag)) {
                return res.status(200).json({ success: false, message: 'Invalid Tag' });
            }

            await MongoService.connect();
            const collection = Type === 'clan' ? config.mongoDB.clanDB : config.mongoDB.playerDB;
            let record = await MongoService.findOne(collection, { id: PhoneNumber });
            let tags = record ? record[`${Type === 'clan' ? 'Ctag' : 'Ptag'}`] || '' : '';
            let tagArray = tags.split(' ').filter(Boolean);
            if (Action === 'add') {
                if(tagArray.includes(Tag)) {
                    return res.status(200).json({ success: false, message: `${Type.charAt(0).toUpperCase() + Type.slice(1)} already exists` });
                }
                tagArray.push(Tag);
            }else{
                if(!tagArray.includes(Tag)) {
                    return res.status(200).json({ success: false, message: `${Type.charAt(0).toUpperCase() + Type.slice(1)} does not exist` });
                }
                tagArray = tagArray.filter(tag => tag !== Tag);
            }
            const updatedTags  = tagArray.join(' ').trim();
            if(record){
                await MongoService.updateOne(collection, { id: PhoneNumber }, { [`${Type === 'clan' ? 'Ctag' : 'Ptag'}`]: updatedTags });
            }else{
                await MongoService.insertOne(collection, { id: PhoneNumber, [`${Type === 'clan' ? 'Ctag' : 'Ptag'}`]: updatedTags });
            }
            await MongoService.disconnect();
            return res.status(200).json({ success: true, message: `${Type.charAt(0).toUpperCase() + Type.slice(1)} ${Action === 'add' ? 'added' : 'removed'} successfully` });
        }catch(error){
            logger.error('Failed to add record: ' + error);
            console.log('error:', error);
            await MongoService.disconnect();
            return res.status(500).json({ success: false, message: 'Failed to add record' });
        }
    }
}

module.exports = LinkController;