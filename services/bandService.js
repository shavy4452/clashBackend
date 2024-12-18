const axios = require('axios');
const crypto = require('crypto');
const querystring = require('querystring');
const logger = require('../utils/logger');

class BandService {
    constructor() {
        this.bands = [];
        this.baseURL = "https://api-sg.band.us";
        this.messageAPI = "/v1/chat/send_message?client_info=%7B%22language%22%3A%22en%22%2C%22country%22%3A%22IN%22%2C%22version%22%3A1%2C%22agent_type%22%3A%22web%22%2C%22agent_version%22%3A%223.3.1%22%2C%22resolution_type%22%3A4%7D&language=en&country=IN&version=1&akey=bbc59b0b5f7a1c6efe950f6236ccda35&DEVICE-TIME-ZONE-ID=Asia%2FKolkata&DEVICE-TIME-ZONE-MS-OFFSET=19800000";
        this.writePost = "/v2.0.1/create_post?client_info=%7B%22language%22%3A%22en%22%2C%22country%22%3A%22IN%22%2C%22version%22%3A1%2C%22agent_type%22%3A%22web%22%2C%22agent_version%22%3A%223.3.1%22%2C%22resolution_type%22%3A4%7D&language=en&country=IN&version=1&akey=bbc59b0b5f7a1c6efe950f6236ccda35&DEVICE-TIME-ZONE-ID=Asia%2FKolkata&DEVICE-TIME-ZONE-MS-OFFSET=19800000"
        this.get_band_members = "/v1.3.0/get_members_of_band?client_info=%7B%22language%22%3A%22en%22%2C%22country%22%3A%22IN%22%2C%22version%22%3A1%2C%22agent_type%22%3A%22web%22%2C%22agent_version%22%3A%223.3.1%22%2C%22resolution_type%22%3A4%7D&language=en&country=IN&version=1&akey=bbc59b0b5f7a1c6efe950f6236ccda35&DEVICE-TIME-ZONE-ID=Asia%2FKolkata&DEVICE-TIME-ZONE-MS-OFFSET=19800000"
        this.get_band_applicant = "/v2.0.1/get_application_of_band?client_info=%7B%22language%22%3A%22en%22%2C%22country%22%3A%22IN%22%2C%22version%22%3A1%2C%22agent_type%22%3A%22web%22%2C%22agent_version%22%3A%223.3.1%22%2C%22resolution_type%22%3A4%7D&language=en&country=IN&version=1&akey=bbc59b0b5f7a1c6efe950f6236ccda35&DEVICE-TIME-ZONE-ID=Asia%2FKolkata&DEVICE-TIME-ZONE-MS-OFFSET=19800000"
        this.accept_applicant = "/v2.0.0/accept_application?client_info=%7B%22language%22%3A%22en%22%2C%22country%22%3A%22IN%22%2C%22version%22%3A1%2C%22agent_type%22%3A%22web%22%2C%22agent_version%22%3A%223.3.1%22%2C%22resolution_type%22%3A4%7D&language=en&country=IN&version=1&akey=bbc59b0b5f7a1c6efe950f6236ccda35&DEVICE-TIME-ZONE-ID=Asia%2FKolkata&DEVICE-TIME-ZONE-MS-OFFSET=19800000"
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
         * @param {boolean} is_notice Whether the post is a notice or not.
         * @returns {object|null} The JSON response or null if an error occurs.
        */
    async createBandPost(content, photo, bandNo, headers, requestkey, is_notice = false) {
        
        try {
            const timestamp = Math.round(Date.now() / 1000) * 1000;
            const md = this.md(this.writePost, requestkey).md;
            headers['md'] = md;
            headers['Content-Type'] = 'application/x-www-form-urlencoded';
            headers['referer'] = 'https://band.us/band/' + bandNo;

            const data = new URLSearchParams({
                'band_no': bandNo,
                'content': content,
                'set_band_notice': is_notice,
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
            // if status is 203, then temporary error occurred, retry the request
            return { success: true, data: response.data, message: "Band post created successfully" };
        }catch(error){
            console.error("Error occurred while creating band post:", error);
            return { success: false, message: "Failed to create band post" };
        }
    }

    /*
    * Get band applicants
    * @param {string} bandNo The band number for which the applicants are to be fetched.
    * @param {object} headers The headers to use for the request.
    * @param {string} requestKey The request key to use for the request.
    * @returns {object|null} The JSON response or null if an error occurs.
    */
    async getBandApplicants(bandNo, headers, requestKey) {
        try{
            const timestamp = Math.round(Date.now() / 1000) * 1000;
            const url = `${this.get_band_applicant}&band_no=${bandNo}`;
            const md = this.md(url, requestKey).md;
            headers['md'] = md;

            const response = await axios.get(`${this.baseURL}${url}&ts=${timestamp}`, { headers });
            const data = response.data;
            if (data.result_data?.message === "You are not authorized.") {
                logger.error("BandService.getBandApplicants: Authorization error while getting band applicants:", data.result_data);
                console.error("Authorization error while getting band applicants:", data.result_data.message);
                return { success: false, message: data.result_data.message };
            }
            return { success: true, data };
        }catch(error){
            console.error("Error occurred while getting band applicants:", error);
            return { success: false, message: "Failed to get band applicants" };
        }
    }

    /*
    * Get band members
    * @param {string} bandNo The band number for which the members are to be fetched.
    * @param {object} headers The headers to use for the request.
    * @param {string} requestKey The request key to use for the request.
    * @returns {object|null} The JSON response or null if an error occurs.
    */
    async getBandMembers(bandNo, headers, requestKey) {
        try {
            const timestamp = Math.round(Date.now() / 1000) * 1000;
            const url = `${this.get_band_members}&band_no=${bandNo}`;
            const md = this.md(url, requestKey).md;
            headers['md'] = md;

            const response = await axios.get(`${this.baseURL}${url}&ts=${timestamp}`, { headers });
            const data = response.data;

            if (data.result_data?.message === "You are not authorized.") {
                console.error("Authorization error while getting band members:", data.result_data.message);
                return { success: false, message: data.result_data.message };
            }

            return { success: true, data };
        } catch (error) {
            console.error("Error occurred while getting band members:", error);
            return { success: false, message: "Failed to get band members" };
        }
    }

    /*
    * Accept a band applicant
    * @param {string} bandNo The band number for which the applicant is to be accepted.
    * @param {string} applicantNo The applicant number to accept.
    * @param {object} headers The headers to use for the request.
    * @param {string} requestKey The request key to use for the request.
    * @returns {object|null} The JSON response or null if an error occurs.
    * */
    async acceptBandApplicant(bandNo, applicantNo, headers, requestKey) {
        try {
            const timestamp = Math.round(Date.now() / 1000) * 1000;
            const url = `${this.accept_applicant}`;
            const md = this.md(url, requestKey).md;
            headers['md'] = md;
            headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8'

            const data = querystring.stringify({
                band_no: bandNo,
                member_key: applicantNo
            });

            const response = await axios.post(`${this.baseURL}${url}&ts=${timestamp}`, data, { headers });
            const res = response.data;

            if (res.result_data?.message === "You are not authorized.") {
                console.error("Authorization error while accepting band applicant:", res.result_data.message);
                return { success: false, message: res.result_data.message };
            }

            return { success: true, res, message: "Band applicant accepted successfully" };
        } catch (error) {
            console.error("Error occurred while accepting band applicant:", error);
            return { success: false, message: "Failed to accept band applicant" };
        }
    }

    /*
    * Get shortlink for a band
    * @param {string} bandNo The band number for which the shortlink is to be fetched.
    * @param {object} headers The headers to use for the request.
    * @returns {object|null} The JSON response or null if an error occurs.
    * */
   async getShortlinkRedirect(url, headers){
        try {
            const response = await axios.get(url, { headers });
            
            try {
                if (response.status === 200) {
                    let _bandNo = null;
                    const bandNoMatch = response.data.match(/bandNo: '(.+?)'/);
                    if (bandNoMatch) {
                        _bandNo = bandNoMatch[1];
                    }else{
                        _bandNo = null;
                    }
                    return { success: true, data: { bandNo: _bandNo } };
                }else{
                    return { success: false, message: "Failed to get shortlink redirect" };
                }
                
            } catch (error) {
                console.error("Error occurred while getting shortlink redirect:", error);
                return { success: false, message: "Failed to get shortlink redirect" };
            }
        } catch (error) {
            console.error("Error occurred while getting shortlink redirect:", error);
            return { success: false, message: "Failed to get shortlink redirect" };
        }
    }
}

module.exports = new BandService();