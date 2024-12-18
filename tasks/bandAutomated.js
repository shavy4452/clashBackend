const fs = require('fs');
const path = require('path');
const NodeCache = require('node-cache');
const BandService = require('../services/bandService');
const MongoService = require('../services/mongoService');
const logger = require('../utils/logger');
const config = require('../config/config');
const clashService = require('../services/clashService');
const mappedUrls = require('../config/shortlink');

class BandAPISyncing {
    constructor() {
        this.pollingInterval = 30 * 1000;
        this.credentialsFetchInterval = 4 * 60 * 60 * 1000; // 4 hours
        this.cache = new NodeCache({ stdTTL: 60, checkperiod: 120 });
        this.credentials = null;
        this.lastFetchedCredentialsTime = 0;
        this.processedUsers = new Set(); // Track processed users within a poll cycle
        this.membersFilePath = path.join(__dirname,  '/../logs/band_members.json'); // Path to the file storing members data
        this.bandApplicantsFilePath = path.join(__dirname,  '/../logs/band_applicants.json'); // Path to the file storing band applicants data
        this.bandNos = {
            "FWL-ENTRY": 59381307,
            "gfidleaders": 59074391,
            "fwlsyncband": 63896472,
            "fwlcommunity": 94858646,
            "fwlstaffband": 95047486,
        };
        this.shortlinks = mappedUrls;
        this.config = config;
        this.clashService = clashService;
    }

    async shortlinkURLRedirectChecker(){
        try{
            const credentials = await this.fetchCredentials();
            const { sk, auth, cookies } = credentials;
            const headers = {
                "Accept-Language": "en-US,en;q=0.9",
                "Content-Type": "application/x-www-form-urlencoded",
                "Connection": "keep-alive",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3",
                "Cookie": cookies,
            };
            const urls = this.shortlinks;   
            for (const data of urls) {
                const url = data.url;
                const bandNo = data.bandNo;
                const response = await BandService.getShortlinkRedirect(url, headers);
                if (response.success) {
                    if(response.data.bandNo !== bandNo){
                        await BandService.sendMessageToChatInBand(
                            `URL Redirect Error - Band ID Mismatch: ${url} redirected to band ID #${response.data.bandNo} instead of band ID #${bandNo}`,
                            sk,
                            headers,
                            this.bandNos["fwlstaffband"],
                            "Cr8zVB",
                            JSON.stringify({ language: "en" })
                        );
                    }
                } else {
                    logger.error(`Failed to redirect ${url}`);
                    await BandService.sendMessageToChatInBand(
                        `URL Redirect Error: Failed to redirect ${url} to band ID #${bandNo}`,
                        sk,
                        headers,
                        this.bandNos["fwlstaffband"],
                        "Cr8zVB",
                        JSON.stringify({ language: "en" })
                    );
                }
            }
            logger.info(`Checked a total of ${urls.length} shortlinks`);
        }catch(error){
            logger.error('Error fetching shortlink URL:', error);
        }
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

    async loadBandApplicantsPreviousData() {
        if (fs.existsSync(this.bandApplicantsFilePath)) {
            const fileData = fs.readFileSync(this.bandApplicantsFilePath, 'utf-8');
            try {
                return JSON.parse(fileData);
            } catch (error) {
                logger.error('Error parsing saved band applicants data:', error);
            }
        }else{
            fs.writeFileSync(this.bandApplicantsFilePath, JSON.stringify({}, null, 2));
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
                var content = `▣ Left: Band ID #${member.user_no} #${bandName} #left\n\nName: ${member.name}\nRole: ${member.role}\nProfile: ${member.profile_image_url}\nAcount Created: ${member.created_at}\n`;
                await this.createNotificationPost(content);
                logger.info(`Removed members from ${bandName}:`);
            });
        }

        const oldMemberMap = new Map(oldMembers.map(member => [member.user_no, member]));
        const addedMembers = newMembers.filter(newMember => !oldMemberMap.has(newMember.user_no));
        if (addedMembers.length > 0) {
            addedMembers.forEach(async member => {
                var content = `◫ Joined: Band ID #${member.user_no} #${bandName} #joined\n\nName: ${member.name}\nProfile: ${member.profile_image_url}\nAcount Created: ${member.created_at}\n`;
                await this.createNotificationPost(content);
                logger.info(`Added members to ${bandName}:`);
            });
        }

        oldMembers.forEach(async oldMember => {
            const newMember = newMemberMap.get(oldMember.user_no);
            if (newMember) {
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
        if(this.config.isProduction){
            BandService.createBandPost(content, '', "91806316", headers, sk, false);
        }
    }


    async fetchApplicants() {
        try {
            const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))
            const credentials = await this.fetchCredentials();
            const { sk, auth, cookies } = credentials;
            const headers = {
                "Accept-Language": "en-US,en;q=0.9",
                "Content-Type": "application/x-www-form-urlencoded",
                "Connection": "keep-alive",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3",
                "Cookie": cookies,
            };
    
            const bandName = "FWL-ENTRY";
            const bandNo = this.bandNos[bandName];
            const clanTagRegex = /^#[PYLQGRJCUV0289]{3,9}$/;
    
            const allMembers = await this.loadBandApplicantsPreviousData();
            allMembers[bandName] = allMembers[bandName] || [];
    
            const applicants = await BandService.getBandApplicants(bandNo, headers, sk);
            if (!applicants.success) {
                logger.error("Failed to fetch band applicants.");
                return;
            }
    
            const members = applicants.data.result_data.items || [];
    
            const processApplicant = async (member) => {
                if (allMembers[bandName].some(existing => existing.member_key === member.member_key)) {
                    if (member.status === "BANNED_INFORMED" || member.status === "BANNED") return;
                }
    
                member.status = "pending";
                member.tag = "UNKNOWN";
                member.user_no = "UNKNOWN";
    
                if (member.join_answer) {
                    const answers = Array.isArray(member.join_answer) ? member.join_answer : member.join_answer.split(" ");
                    for (let tag of answers) {
                        if (!tag.startsWith("#")) tag = `#${tag.toUpperCase()}`;
                        if (clanTagRegex.test(tag)) {
                            member.tag = tag;
                            break;
                        }
                    }
                }
    
                const backendMessage = await handleApplicantAcceptance(member, bandNo, headers, sk);
                if (backendMessage) {
                    await BandService.sendMessageToChatInBand(
                        backendMessage,
                        sk,
                        headers,
                        this.bandNos["fwlstaffband"],
                        "Cr8zVB",
                        JSON.stringify({ language: "en" })
                    );
                    allMembers[bandName].push(member);
                }
            };
    
            const handleApplicantAcceptance = async (member, bandNo, headers, sk) => {
                const userAccepted = await BandService.acceptBandApplicant(bandNo, member.member_key, headers, sk);
                if (!userAccepted.success) {
                    logger.error(`Failed to accept applicant: ${member.applicant_name}`);
                    member.status = "error";
                    return null;
                }
    
                await delay(5000); // Wait for the system to update
                const bandData = await BandService.getBandMembers(bandNo, headers, sk);
                if (!bandData.success) {
                    logger.error(`Failed to fetch band members after accepting: ${member.applicant_name}`);
                    member.status = "error";
                    return null;
                }
    
                const newMember = bandData.data.result_data.members.find(m => m.name === member.applicant_name);
                if (!newMember) {
                    logger.error(`Newly accepted member not found: ${member.applicant_name}`);
                    member.status = "error";
                    return null;
                }
    
                member.user_no = newMember.user_no;
                member.status = "accepted";
    
                await sendWelcomeMessages(member, bandNo, headers, sk);
    
                let backendMessage = `User ${member.applicant_name} accepted with clan tag ${member.tag}.`;
                backendMessage += `\n Metadata: ${JSON.stringify(member)}`;
    
                if (member.tag !== "UNKNOWN") {
                    const thDetails = await this.clashService.makeTHCompoMessage(member.tag);
                    if (thDetails) {
                        backendMessage += `\nTownhall Composition: ${thDetails}`;
                    }
                }
                return backendMessage;
            };
    
            const sendWelcomeMessages = async (member, bandNo, headers, sk) => {
                const userMessage = `Hi @${member.applicant_name}, Welcome to the 1945 Clan & Rep Entry Band. Please provide your clan tag and your in-game profile screenshot to proceed further.`;
                const extras = JSON.stringify({
                    mention: `Hi <band:refer user_no="${member.user_no}">${member.applicant_name}</band:refer>, Welcome to the 1945 Clan & Rep Entry Band. Please provide your clan tag and your in-game profile screenshot to proceed further.`,
                    language: "en"
                });
    
                await BandService.sendMessageToChatInBand(userMessage, sk, headers, bandNo, "C8_jUB", extras);
    
                const rulesMessage = `
                    Clan Transition and Entry Rules for 1945 Clan\n---\n🍀 Are you here to become a 1945 clan or just here for queries related to 1945?\n🍀 Post Requirements:\n- Screenshot of your in-game profile\n- Screenshot of your clan description\n- Mention your townhall composition\n---\nNew Clan Entry Rules:\n🍀 Standard Composition:\n- 5 slots TH 17\n- 5 slots TH 16\n- 10 slots TH 15\n- 10 slots TH 14\n- 10 slots TH 13\n- 10 slots TH 12\n---\nAbout the League Link:\nhttps://band.us/band/59381307/post/58
                `.trim();
    
                const rulesExtras = JSON.stringify({ language: "en" });
                await BandService.sendMessageToChatInBand(rulesMessage, sk, headers, bandNo, "C8_jUB", rulesExtras);
            };
    
            for (const member of members) {
                await processApplicant(member);
            }
    
            fs.writeFileSync(this.bandApplicantsFilePath, JSON.stringify(allMembers, null, 2));
        } catch (error) {
            logger.error("Error fetching band applicants:", error);
        }
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

            const bandNos = this.bandNos;

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
            await this.fetchApplicants();
            await this.shortlinkURLRedirectChecker();
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
