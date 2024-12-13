const logger = require('../utils/logger.js');
const chalk = require('chalk');
const config = require('../config/config');
const MongoService = require('../services/mongoService');
const BandService = require('../services/bandService');

class BandController {

    static async createSyncBandPost(req, res) {
        try{
            const getCredentials = await MongoService.getCredentialBand();
            const { sk, auth, cookies } = getCredentials;
            const { bandNo } = req.params;
            const contentData = `
            SYNC UPDATE!!! CHECK TIME ON WEB

            Use Google Chrome for check sync!!

            PLEASE stop searching when the window closes after 1.5 hours.
            If you declined the event poll, You need to tick the reason behind declining the event, in Reason Poll
            If you are unsure or no reasons in Reason poll that illustrates your problem, then comment below.
            ✍️Clans will be assisted in the order in which they request. ✍️

            ⌛Please be considerate and accept or decline the event ASAP. ⌛
            ⌚Last minute requests may be declined.⌚

            Use Share The Win Method.

            For more details refer to-:
            https://band.us/band/59074391/post/2323

            Website Link: https://1945.pandaclash.com/login/

            Powered By @1945_bot (Shavy)

            <band:attachment+type="photo"+id="c6324" />`;

            const contentImage = '{"c6324":{"url":"http://sos.campmobile.net/b/34gff7/a_c97Ud018svc1oidcqeac46nj_sbh8ko.jpg","width":150,"height":225}}'
            const headers = {
                "Accept-Language": "en-US,en;q=0.9",
                "Content-Type": "application/x-www-form-urlencoded",
                "Connection": "keep-alive",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3",
                "Cookie": cookies,
            }
            const response = await BandService.createBandPost(contentData, contentImage, bandNo, headers, sk, true);
            
            if(response.success){
                return res.status(200).json({ success: true, message: 'Band post created successfully' });
            }else{
                return res.status(200).json({ success: false, message: 'Failed to create band post' });
            }
        }catch(error){
            logger.error('Failed to create band:', error);
            return res.status(500).json({ success: false, message: 'Failed to create band' });
        }

    }
}

module.exports = BandController;