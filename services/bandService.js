const axios = require('axios');
const crypto = require('crypto');
const querystring = require('querystring');

class BandService {
    constructor() {
        this.bands = [];
        this.baseURL = "https://api-sg.band.us";
        this.messageAPI = "/v1/chat/send_message?client_info=%7B%22language%22%3A%22en%22%2C%22country%22%3A%22IN%22%2C%22version%22%3A1%2C%22agent_type%22%3A%22web%22%2C%22agent_version%22%3A%223.3.1%22%2C%22resolution_type%22%3A4%7D&language=en&country=IN&version=1&akey=bbc59b0b5f7a1c6efe950f6236ccda35&DEVICE-TIME-ZONE-ID=Asia%2FKolkata&DEVICE-TIME-ZONE-MS-OFFSET=19800000";
        this.writePost = "/v2.0.1/create_post?client_info=%7B%22language%22%3A%22en%22%2C%22country%22%3A%22IN%22%2C%22version%22%3A1%2C%22agent_type%22%3A%22web%22%2C%22agent_version%22%3A%223.3.1%22%2C%22resolution_type%22%3A4%7D&language=en&country=IN&version=1&akey=bbc59b0b5f7a1c6efe950f6236ccda35&DEVICE-TIME-ZONE-ID=Asia%2FKolkata&DEVICE-TIME-ZONE-MS-OFFSET=19800000"
    }

    md(URL, requestKey) {
        const timestamp = Math.round(Date.now() / 1000) * 1000;
        const Url = `${URL}&ts=${timestamp}`;
        
        const MD = crypto
        .createHmac('sha256', requestKey)
        .update(Url)
        .digest('base64');
        
        const params = {
        md: MD,
        ts: timestamp,
        };
        return params;
    }  

    /**
     * Sends a message to a chat in a band.
     * 
     * @param {string} content The content of the message to send.
     * @param {string} secretKey The secret key to use for the request.
     * @param {object} headers The headers to use for the request.
     * @param {string} bandNo The band number to send the message to.
     * @param {string} chatID The chat ID to send the message to.
     * @param {string} extras The extras to use for the request.
     * @returns {object} The JSON response.
     * */
    async sendMessageToChatInBand(content, secretKey, headers, bandNo, chatID, extras = "{\"language\":\"en\"}") {
        try {
        const timestamp = Math.round(Date.now() / 1000) * 1000;
        const encodedContent = encodeURIComponent(content);
        const encodedExtras = encodeURIComponent(extras);

        const url = `${this.messageAPI}&message_type=1&band_no=${bandNo}&channel_id=${chatID}&content=${encodedContent}&extras=${encodedExtras}`;
        console.log('url:', url);
        const md = this.md(url, secretKey).md;
        headers['md'] = md;

        const response = await axios.get(`${this.baseURL}${url}&ts=${timestamp}`, { headers });
        const data = response.data;

        if (data.result_data?.message === "You are not authorized.") {
            console.error("Authorization error while sending message:", data.result_data.message);
            return { success: false, message: data.result_data.message, retry: true };
        }

        return { success: true, data };
        } catch (error) {
        console.error("Error occurred while sending message to chat in band:", error);
        return { success: false, message: "Failed to send message to chat in band" };
        }
    }
  
    /**
         * Creates a post for a given band number.
         *
         * @param {string} content The content of the post to create.
         * @param {string} photo The photo to use for the post.
         * @param {string} bandNo The band number for which the post is to be created.
         * @param {object} headers The headers to use for the request.
         * @param {string} requestkey The request key to use for the request.
         * @returns {object|null} The JSON response or null if an error occurs.
        */
    async createBandPost(content, photo, bandNo, headers, requestkey) {
        
        try {
            const timestamp = Math.round(Date.now() / 1000) * 1000;
            const md = this.md(this.writePost, requestkey).md;
            headers['md'] = md;
            headers['Content-Type'] = 'application/x-www-form-urlencoded';
            headers['referer'] = 'https://band.us/band/' + bandNo;

            const data = new URLSearchParams({
                'band_no': bandNo,
                'content': content,
                'set_band_notice': true,
                'set_major_band_notice': false,
                'set_linked_band_notice': '',
                'should_disable_comments': '',
                'band_notice_unset_at': '',
                'photo': photo,
                'purpose': 'create'
            });

            const response = await axios.post(this.baseURL + this.writePost + `&ts=${timestamp}`, data, { headers });
            if (response.data.result_data?.message === "You are not authorized.") {
                console.error("Authorization error while creating band post:", response.data.result_data.message);
                return { success: false, message: response.data.result_data.message };
            }
            console.log('response:', response.data);
            return { success: true, data: response.data, message: "Band post created successfully" };
        }catch(error){
            console.error("Error occurred while creating band post:", error);
            return { success: false, message: "Failed to create band post" };
        }
    }
}

module.exports = new BandService();