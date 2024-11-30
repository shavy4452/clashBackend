require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { initClashOfClansClient } = require('./helpers/cocauth');
const { sendDiscordWebhook } = require('./helpers/errorHandler');
const jwt = require('jsonwebtoken');
const { Exception } = require('handlebars');
const dbClient = require('./helpers/db');
// import utils from clashofclans.js
const { Util } = require('clashofclans.js');

const app = express();
const server = http.createServer(app);

const generateAnonymousToken = () => {
  const secretKey = process.env.JWT_SECRET || "kbvgedcyxuhjvgushdxhsfxdyguydsgxbuywgsyugbwquiu09w7878yhhyugduhudhytgysgysgftyfg";
  const payload = {
    userId: Math.random().toString(36).substring(2), // Generate a random userId
    anonymous: true,
  };
  const options = { expiresIn: '24h' };
  return jwt.sign(payload, secretKey, options);
};

// const anonymousToken = generateAnonymousToken();
// console.log('[INFO] Anonymous token:', anonymousToken);
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  next();
});


const wss = new WebSocket.Server({
  noServer: true,
  verifyClient: (info, callback) => {
    const token = info.req.headers['sec-websocket-protocol'];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.userId) {
        console.log('[INFO] User authenticated:', decoded.userId);
        info.req.userId = decoded.userId;
        info.req.token = token;
        callback(true);
      } else {
        console.log('[INFO] User not authenticated');
        sendDiscordWebhook('Unauthorized WebSocket connection attempt from ' + info.req.connection.remoteAddress + ' with invalid token');
        callback(false, 401, 'Unauthorized');
      }
    } catch (error) {
      console.log('[INFO] User not authenticated with error:', error.message);
      sendDiscordWebhook('Unauthorized WebSocket connection attempt from ' + info.req.connection.remoteAddress + ' with error: ' + error.message);
      callback(false, 401, 'Unauthorized'); // Connection rejected
    }
  },
});

server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

let clashClient; 

const startServer = async () => {
    try{
        clashClient = await initClashOfClansClient();
    } catch(e){
        console.log('[ERROR] Clash of Clans client failed to initialize' + e);
        throw Exception ('Clash of Clans client failed to initialize');
    }
    const connectedClients = new Set();
    wss.on('connection', (ws,req) => {
      connectedClients.add(ws);
      ws.on('error', (error) => {
        connectedClients.delete(ws);
        console.error('[ERROR] WebSocket error:', error.message);
      });

      ws.on('message', (message) => {
        if (Buffer.isBuffer(message)) {
          message = message.toString('utf-8');
        }
        console.log('[INFO] Received message:', message);
        if (typeof message === 'string' && message.startsWith('{')) {
          message = JSON.parse(message);
          switch (message.type) {
            case 'getClanInfo':
              if (!message.data.clanId) {
                ws.send(JSON.stringify({ error: 'Missing clanId' }));
                return;
              }else{
                clashClient.getClan(message.data.clanId)
                .then((response) => {
                  if(response.client){
                    delete response.client;
                  }
                  ws.send(JSON.stringify(response));
                })
                .catch((error) => {
                  console.error('[ERROR] Failed to get clan info:', error.message);
                  ws.send(JSON.stringify({ error: error.message }));
                });
              }
              break;
            case 'getPlayersInfo':
              if (!message.data.playerId) {
                ws.send(JSON.stringify({ error: 'Missing playerID' }));
                return;
              }else{
                clashClient.getPlayer(message.data.playerId)
                .then((response) => {
                  delete response.client;
                  if (response.clan && response.clan._client) {
                    delete response.clan._client;
                  }
                  ws.send(JSON.stringify(response));
                })
                .catch((error) => {
                  console.error('[ERROR] Failed to get players info:', error.message);
                  ws.send(JSON.stringify({ error: error.message }));
                });
              }
              break;

            case 'getClanMembers':
            if (!message.data.clanMemberTag || !Array.isArray(message.data.clanMemberTag)) {
              ws.send(JSON.stringify({ error: 'Missing or invalid clanMemberTag' }));
              return;
            }

            const playerPromises = message.data.clanMemberTag.map((playerId) => {
              return clashClient.getPlayer(playerId)
                .then((response) => {
                  delete response.client;
                  if (response.clan && response.clan._client) {
                    delete response.clan._client;
                  }
                  return response;
                })
                .catch((error) => {
                  console.error('[ERROR] Failed to get player info for', playerId, error.message);
                  return { error: error.message };
                });
            });

            Promise.all(playerPromises)
              .then((responses) => {
                ws.send(JSON.stringify(responses));
              })
              .catch((error) => {
                console.error('[ERROR] Failed to process player requests:', error.message);
                ws.send(JSON.stringify({ error: 'Failed to process player requests' }));
              });
            break;

            case 'getCompareData':
            if (!message.data.bothTags || !Array.isArray(message.data.bothTags)) {
              ws.send(JSON.stringify({ error: 'Missing or invalid clanMemberTag' }));
              return;
            }

            const comparePromises = message.data.bothTags.map((playerId) => {
              return clashClient.getPlayer(playerId)
                .then((response) => {
                  delete response.client;
                  if (response.clan && response.clan._client) {
                    delete response.clan._client;
                  }
                  return response;
                })
                .catch((error) => {
                  console.error('[ERROR] Failed to get player info for', playerId, error.message);
                  return { error: error.message };
                });
            });

            Promise.all(comparePromises)
              .then((responses) => {
                ws.send(JSON.stringify(responses));
              })
              .catch((error) => {
                console.error('[ERROR] Failed to process player requests:', error.message);
                ws.send(JSON.stringify({ error: 'Failed to process player requests' }));
              });
            break;


            case 'GoldPassSeason':
              clashClient.getGoldPassSeason()
              .then((response) => {
                ws.send(JSON.stringify(response));
              })
              .catch((error) => {
                console.error('[ERROR] Failed to get gold pass season:', error.message);
                ws.send(JSON.stringify({ error: error.message }));
              });
              break;

            case 'getLocations':
              clashClient.getLocations()
              .then((response) => {
                ws.send(JSON.stringify(response));
              })
              .catch((error) => {
                console.error('[ERROR] Failed to get locations list:', error.message);
                ws.send(JSON.stringify({ error: error.message }));
              });
              break;

              case 'getLocationRanking':
                if (!message.data.locationId) {
                  ws.send(JSON.stringify({ error: 'Missing locationId' }));
                  return;
                }
                const endpoints = [
                  'getClanRanks',
                  'getPlayerRanks',
                  'getBuilderBaseClanRanks',
                  'getBuilderBasePlayerRanks',
                  'getClanCapitalRanks'
                ];
                const requests = endpoints.map(endpoint =>
                  clashClient[endpoint](message.data.locationId, { limit: 10 })
                    .then(response => {
                      delete response.client;
                      if (Array.isArray(response)) {
                        response.forEach(player => {
                          if (player.clan && player.clan._client) {
                            delete player.clan._client;
                          }
                        });
                      }
                      return { type: endpoint, response };
                    })
                    .catch(error => {
                      console.error(`[ERROR] Failed to get ${endpoint} ranking:`, error.message);
                      return { type: endpoint, error: error.message };
                    })
                );
                Promise.all(requests)
                  .then(results => {
                    ws.send(JSON.stringify(results));
                  });
                break;
          }
        }
      });

      wss.on('close', () => {
        connectedClients.delete(ws);
        const userId = req.userId;
        console.log('[INFO] WebSocket connection closed for userId: ', userId);
        });
      });

      const broadcast = (message) => {
        connectedClients.forEach(client => {
          try {
            client.send(message);
          } catch (error) {
            console.error('[ERROR] Failed to send message to a client:', error.message);
          }
        });
      };

      const authenticateJWT = (req, res, next) => {
        const token = req.header('Authorization');
        if (!token) {
          return res.status(401).json({ error: 'Unauthorized - Missing token' });
        }
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          req.userId = decoded.userId;
          req.token = token;
          next();
        } catch (error) {
          console.error('[INFO] User not authenticated with error:', error.message);
          return res.status(401).json({ error: 'Unauthorized - Invalid token' });
        }
      };
      app.use(express.json());
      app.use('/api', authenticateJWT);

      app.post('/api/getClanInfo/:tag', (req, res) => {
        var tag = req.params.tag.toUpperCase();
        if (!tag) {
          res.status(400).json({ success: false, message: 'Missing clanId' });
          return;
        }
        clashClient.getClan(tag)
          .then(response => {
            delete response.client;
            res.status(200).json({ success: true, data: response });
          })
          .catch(error => {
            console.error('[ERROR] Failed to get clan info:', error.message);
            sendDiscordWebhook('Failed to get clan info:' + error.message, 'Failed to get clan info', 16711680);
            res.status(500).json({ success: false, message: error.message });
          });
      });

      app.post('/api/getCapitalRaidSeason/:tag', (req, res) => {
        try{
          var tag = req.params.tag.toUpperCase();
          if (!tag) {
            res.status(400).json({ success: false, message: 'Missing clanId' });
            return;
          }
          clashClient.getCapitalRaidSeasons(tag)
            .then(response => {
              delete response.client;
              res.status(200).json({ success: true, data: response });
            })
            .catch(error => {
              console.error('[ERROR] Failed to get capital raid season:', error.message);
              sendDiscordWebhook('Failed to get capital raid season:' + error.message, 'Failed to get capital raid season', 16711680);
              res.status(500).json({ success: false, message: error.message });
            });
        }catch(e){
          console.log('[ERROR] Failed to get capital raid season:', e.message);
          res.status(500).json({ success: false, message: e.message });
          return;
        }
      });

      app.post('/api/getClanMembersHero/:tag', async (req, res) => {
        const tag = req.params.tag.toUpperCase();
    
        if (!tag) {
            return res.status(400).json({ success: false, message: 'Missing clan tag' });
        }
    
        try {
            // Fetch clan details
            const clan = await clashClient.getClan(tag);
            if (!clan) {
                return res.status(404).json({ success: false, message: 'Clan not found' });
            }
    
            const clanMembers = clan.members || [];
    
            // Concurrently fetch heroes data for each member
            const membersWithHeroes = await Promise.all(
                clanMembers.map(async (member) => {
                    const memberCopy = { ...member }; // Clone the member object to avoid modifying the original
                    delete memberCopy.client; // Remove unnecessary client property
                    try {
                        const playerData = await clashClient.getPlayer(member.tag);
                        memberCopy.heroes = playerData.heroes || []; // Add heroes or default to an empty array
                    } catch (error) {
                        console.error(`[ERROR] Failed to get player info for ${member.tag}:`, error.message);
                        memberCopy.heroes = []; // Default to an empty array on error
                    }
                    return memberCopy;
                })
            );
    
            // Include the updated members with heroes back into the clan object
            clan.members = membersWithHeroes;
            delete clan.client; // Remove unnecessary client property
    
            // Send the final response with the whole clan data
            return res.status(200).json({ success: true, data: clan });
        } catch (error) {
            console.error('[ERROR] Failed to get clan members:', error.message);
            return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
        }
    });
    

      app.post('/api/getPlayersInfo/:tag', (req, res) => {
        var tag = req.params.tag.toUpperCase();
        if (!tag) {
          res.status(400).json({ success: false, message: 'Missing playerId' });
          return;
        }
        clashClient.getPlayer(tag)
          .then(response => {
            delete response.client;
            if (response.clan && response.clan._client) {
              delete response.clan._client;
            }
            res.status(200).json({ success: true, data: response });
          })
          .catch(error => {
            console.error('[ERROR] Failed to get player info:', error.message);
            sendDiscordWebhook('Failed to get player info:' + error.message, 'Failed to get player info', 16711680);
            res.status(500).json({ success: false, message: error.message });
          });
      });

      app.post('/api/getCurrentWar/:tag', (req, res) => {
        try{
          var tag = req.params.tag.toUpperCase();
          if (!tag) {
            res.status(400).json({ success: false, message: 'Missing clanId' });
            return;
          }
          clashClient.getClanWar(tag)
            .then(response => {
              if(response == null){
                res.status(200).json({ success: false, message: 'Access denied, clan war log is private.' });
                return;
              }
              delete response.client;
              res.status(200).json({ success: true, data: response });
            })
            .catch(error => {
              console.error(error);
              console.error('[ERROR] Failed to get current war:', error.message);
              if (error.message != "Requested resource was not found."){
                sendDiscordWebhook('Failed to get current war:' + error.message, 'Failed to get current war', 16711680);
              }
              res.status(200).json({ success: false, message: error.message });
            });
        }catch(e){
          console.log('[ERROR] Failed to get current war:', e.message);
          res.status(500).json({ success: false, message: e.message });
          return;
        }
      });

      app.post('/api/getWarLog/:tag', (req, res) => {
        try{
          var tag = req.params.tag.toUpperCase();
          var limit = req.query.limit;
          if (!tag) {
            res.status(400).json({ success: false, message: 'Missing clanId' });
            return;
          }
          if (limit && isNaN(limit)) {
            res.status(400).json({ success: false, message: 'Invalid limit' });
            return;
          }
          limit = limit ? parseInt(limit) : 10;
          clashClient.getClanWarLog(tag)
            .then(response => {
              if(response == null){
                res.status(200).json({ success: false, message: 'Access denied, clan war log is private.' });
                return;
              }
              for (i = 0; i < response.length; i++) {
                const war = response[i];
                delete war.client;
              }
              res.status(200).json({ success: true, data: response });
              return;
            })
            .catch(error => {
              console.error('[ERROR] Failed to get current war:', error.message);
              if (error.message != "Requested resource was not found."){
                sendDiscordWebhook('Failed to get current war:' + error.message, 'Failed to get current war', 16711680);
              }
              res.status(200).json({ success: false, message: error.message });
            });
        }catch(e){
          console.log('[ERROR] Failed to get war log:', e.message);
          res.status(500).json({ success: false, message: e.message });
          return;
        }
      });

      app.post('/api/getTHLevels/:clanTag', async (req, res) => {
        try{
          const clanTag = req.params.clanTag.toUpperCase();
          if (!clanTag) {
            res.status(400).json({ success: false, message: 'Missing clanTag' });
            return;
          }
          let [TH17,TH16,TH15,TH14, TH13, TH12, TH11, TH10, TH09, TH08, TH07, TH06, TH05, TH04, TH03] = [0,0,0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
          var requests = [];
          var clan = await clashClient.getClan(clanTag);
          var clanMembers = await clashClient.getClanMembers(clanTag);
          for (const member of clanMembers) { 
            const TownHAll = member.townHallLevel;
            if(TownHAll == 17) TH17++;
            if(TownHAll == 16) TH16++;
            if(TownHAll == 15) TH15++;
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
          ].filter(townHall => townHall.total !== 0).reverse();
          const math = (TH17 * 17 ) + (TH16 * 16) + (TH15 * 15) + (TH14 * 14) + (TH13 * 13) + (TH12 * 12) + (TH11 * 11) + (TH10 * 10) + (TH09 * 9) + (TH08 * 8) + (TH07 * 7) + (TH06 * 6) + (TH05 * 5) + (TH04 * 4) + (TH03 * 3);
          const average = math / (TH16 + TH15 + TH14 + TH13 + TH12 + TH11 + TH10 + TH09 + TH08 + TH07 + TH06 + TH05 + TH04 + TH03) || 0;
          const estWeight = (TH17 *  170000) + (TH16 * 160000) + (TH15 * 150000) + (TH14 * 140000) + (TH13 * 125000) + (TH12 * 115000) + (TH11 * 102000) + (TH10 * 80000) + (TH09 * 63000) + (TH08 * 50000) + (TH07 * 38000) + (TH06 * 28000) + (TH05 * 18000) + (TH04 * 8000) + (TH03 * 6000)
          let resp = {
            name: clan.name,
            tag: clan.tag,
            townHalls,
            estWeight,
            average,
            total: TH17 + TH16 + TH15 + TH14 + TH13 + TH12 + TH11 + TH10 + TH09 + TH08 + TH07 + TH06 + TH05 + TH04 + TH03 
          }
          return res.status(200).json({ success: true, data: resp });
        }catch(e){
          console.log('[ERROR] Failed to get TH levels:', e.message);
          res.status(500).json({ success: false, message: e.message });
          return;
        }
      });

      app.post('/api/getCWLresults/:tag', async (req, res) => {
        try{
          var tag = req.params.tag.toUpperCase();
          if (!tag) {
            res.status(400).json({ success: false, message: 'Missing clanId' });
            return;
          }
          const warLog = await clashClient.getClanWarLeagueGroup(tag);
          if (!warLog) {
            res.status(400).json({ success: false, message: 'Clan not in CWL' });
            return;
          }
          const warLogPromises = warLog.rounds.map(async (round) => {
            const warPromises = round.warTags.map(async (warTag) => {
              const war = await clashClient.getClanWar(warTag);
              return war;
            });
            const wars = await Promise.all(warPromises);
            return wars;
          }
          );
        }catch(e){
          console.log('[ERROR] Failed to get CWL results:', e.message);
          if (e.status==404) return res.status(200).json({ success: false, message: e.message });
          if (e.status==403) return res.status(200).json({ success: false, message: e.message });
          if (e.status==500) return res.status(200).json({ success: false, message: e.message });
          res.status(500).json({ success: false, message: e.message });
          return;
        }
      });

      app.post('/api/getWarWeight/:tag', async (req, res) => {
        try{
          var tag = req.params.tag.toUpperCase();
          if (!tag) {
            res.status(400).json({ success: false, message: 'Missing playerId' });
            return;
          }
          let [TH17,TH16,TH15,TH14, TH13, TH12, TH11, TH10, TH09, TH08, TH07, TH06, TH05, TH04, TH03] = [
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
          const war = await clashClient.getClanWar(tag);
          if (!war) {
            res.status(200).json({ success: false, message: 'Clan not in war' });
            return;
          }
          if (war.state === 'notInWar') {
            res.status(200).json({ success: false, message: 'Clan not in war' });
            return;
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
          ]
            .filter((townHall) => townHall.total !== 0)
            .reverse();
            const estWeight = (TH17* 160000) + (TH16 * 160000) + (TH15 * 150000) + (TH14 * 140000) + (TH13 * 125000) + (TH12 * 115000) + (TH11 * 102000) + (TH10 * 80000) + (TH09 * 63000) + (TH08 * 50000) + (TH07 * 38000) + (TH06 * 28000) + (TH05 * 18000) + (TH04 * 8000) + (TH03 * 6000)
            const total = TH16 + TH15 + TH14 + TH13 + TH12 + TH11 + TH10 + TH09 + TH08 + TH07 + TH06 + TH05 + TH04 + TH03;
            let resp = {
                name: war.clan.name,
                tag: war.clan.tag,
                total,
                townHalls,
                estWeight
            }
            return res.status(200).json({ success: true, data: resp });
        }catch(e){
          console.log('[ERROR] Failed to get war weight:', e.message);
	  if (e.message == 'Access denied, clan war log is private.') return res.status(200).json({ success: false, message: e.message });
          res.status(500).json({ success: false, message: e.message });
          return;
        }
      });

      app.post('/api/db/getRecords/:PhoneNumber', async (req, res) => {
        try{
          var PhoneNumber = req.params.PhoneNumber;
          if (!PhoneNumber) {
            res.status(400).json({ success: false, message: 'Missing PhoneNumber' });
            return;
          }
          await dbClient.connect();
          var database = dbClient.db(process.env.WP_COLLECTION);
          var ClanCollection = database.collection(process.env.CLAN_DB_WP);
          var PlayerCollection = database.collection(process.env.PLAYER_DB_WP);
          let ClanRecord = await ClanCollection.findOne({id:PhoneNumber});
          let PlayerRecord = await PlayerCollection.findOne({id:PhoneNumber});
          if(ClanRecord && ClanRecord.Ctag){
            ClanRecord = ClanRecord.Ctag.split(" ");
            
          }else{
            ClanRecord = [];
          }
          if(PlayerRecord && PlayerRecord.Ptag){
            PlayerRecord = PlayerRecord.Ptag.split(" ");
          }else{
            PlayerRecord = [];
          }
          let resp = {
            ClanRecord,
            PlayerRecord
          }
          await dbClient.close();
          return res.status(200).json({ success: true, data: resp });
        }catch(e){
          console.log('[ERROR] Failed to get clan record:', e.message);
          res.status(500).json({ success: false, message: e.message });
          return;
        }
      });

      app.post('/api/db/addRecord/:PhoneNumber/:Type/:Tag/:Action', async (req, res) => {
        try{
          var PhoneNumber = req.params.PhoneNumber;
          var Type = req.params.Type;
          var Tag = req.params.Tag;
          var Action = req.params.Action;
          if (!PhoneNumber) {
            return res.status(400).json({ success: false, message: 'Missing PhoneNumber' });
          }
          if (!Type) {
            return res.status(400).json({ success: false, message: 'Missing Type' });
          }
          if (!Tag) {
            return res.status(400).json({ success: false, message: 'Missing Tag' });
          }
          if (!Action) {
            return res.status(400).json({ success: false, message: 'Missing Action' });
          }
          if(Action != "add" && Action != "remove"){
            return res.status(400).json({ success: false, message: 'Invalid Action' });
          }
          if (Type != "clan" && Type != "player") {
            return res.status(400).json({ success: false, message: 'Invalid Type' });
            ;
          }
          // check tag and add  if its valid
          isValid = Util.isValidTag(Tag);
          if (!isValid) {
            return res.status(400).json({ success: false, message: 'Invalid Tag' });
          }else if(!Tag.startsWith("#")){
            Tag = "#" + Tag;
          }
          await dbClient.connect();
          let success = false;
          let message = "";
          let dbTags = "";
          var database = dbClient.db(process.env.WP_COLLECTION);
          if(Type === "clan"){
            var ClanCollection = database.collection(process.env.CLAN_DB_WP);
            let ClanRecord = await ClanCollection.findOne({id:PhoneNumber});
            if(Action === "add"){
              if(ClanRecord && ClanRecord.Ctag){
                dbTags = ClanRecord.Ctag;
                if(dbTags.split(" ").length >= 5){
                  return res.status(201).json({ success: false, message: 'You can only add 5 clans' });
                }
                if(dbTags.includes(Tag)){
                  return res.status(201).json({ success: false, message: 'Clan already added' });
                }
                dbTags = dbTags + " " + Tag;
              }else{
                dbTags = Tag;
		await ClanCollection.insertOne({id:PhoneNumber,Ctag:Tag});
                await dbClient.close();
                return res.status(200).json({ success: true, message: 'Clan Record Added' });
              }
            }else if(Action === "remove"){
              if(ClanRecord && ClanRecord.Ctag){
                dbTags = ClanRecord.Ctag;
                if(!dbTags.includes(Tag)){
                  return res.status(200).json({ success: false, message: 'Clan not found' });
                }
                dbTags = dbTags.replace(Tag,"");
                dbTags = dbTags.replace(/\s\s+/g, ' ');
                dbTags = dbTags.trim();
              }else{
                return res.status(200).json({ success: false, message: 'Clan not found in your profile.' });
              }
            }
            console.log(dbTags , "dbTags");
            await ClanCollection.updateOne({id:PhoneNumber}, {$set: {Ctag:dbTags}});
            success = true;
            message = "Clan Record Updated";
          }else if(Type == "player"){
            var PlayerCollection = database.collection(process.env.PLAYER_DB_WP);
            let PlayerRecord = await PlayerCollection.findOne({id:PhoneNumber});
            if(Action == "add"){
              if(PlayerRecord && PlayerRecord.Ptag){
                dbTags = PlayerRecord.Ptag;
                if(dbTags.split(" ").length >= 5){
                  return res.status(201).json({ success: false, message: 'You can only add 5 players' });
                }
                if(dbTags.includes(Tag)){
                  return res.status(201).json({ success: false, message: 'Player already added' });
                }
                dbTags = dbTags + " " + Tag;
              }else{
                dbTags = Tag;
		await PlayerCollection.insertOne({id:PhoneNumber,Ptag:Tag});
                await dbClient.close();
                return res.status(200).json({ success: true, message: 'Player Record Added' });
              }
            }else if(Action == "remove"){
              if(PlayerRecord && PlayerRecord.Ptag){
                dbTags = PlayerRecord.Ptag;
                if(!dbTags.includes(Tag)){
                  return res.status(200).json({ success: false, message: 'Player not found' });
                }
                dbTags = dbTags.replace(Tag,"");
                dbTags = dbTags.replace(/\s\s+/g, ' ');
                dbTags = dbTags.trim();
              }else{
                return res.status(200).json({ success: false, message: 'Player not found in your profile.' });
              }
            }
            await PlayerCollection.updateOne({id:PhoneNumber}, {$set: {Ptag:dbTags}});
            success = true;
            message = "Player Record Updated";
          }
          await dbClient.close();
          return res.status(200).json({ success: success, message: message });
        }catch(e){
          console.log('[ERROR] Failed to update record:', e.message);
          return res.status(500).json({ success: false, message: e.message });
        }
      });

      app.post('/api/db/getWelcomeMessage/:chat_id', async (req, res) => {
        try{
          var chat_id = req.params.chat_id;
          if (!chat_id) {
            return res.status(200).json({ success: false, message: 'Missing chat_id' });
          }
          await dbClient.connect();
          var database = dbClient.db(process.env.WP_COLLECTION);
          var WelcomeCollection = database.collection(process.env.WELCOME_MESSAGE_WP_GROUPS);
          let WelcomeRecord = await WelcomeCollection.findOne({id:chat_id});
          if(WelcomeRecord && WelcomeRecord.message){
            WelcomeRecord = WelcomeRecord.message;
          }else{
            WelcomeRecord = "";
          }
          await dbClient.close();
          return res.status(200).json({ success: true, data: WelcomeRecord });
          
        }catch(e){
          console.log('[ERROR] Failed to get welcome message:', e.message);
          return res.status(500).json({ success: false, message: e.message });
        }
      });

      app.post('/api/db/setWelcomeMessage/:chat_id', async (req, res) => {
        try{
          var chat_id = req.params.chat_id;
          var message = req.body.message;
          if (!chat_id) {
            return res.status(200).json({ success: false, message: 'Missing chat_id' });
          }
          if (!message) {
            return res.status(200).json({ success: false, message: 'Missing message' });
          }
          await dbClient.connect();
          var database = dbClient.db(process.env.WP_COLLECTION);
          var WelcomeCollection = database.collection(process.env.WELCOME_MESSAGE_WP_GROUPS);
          await WelcomeCollection.updateOne({id:chat_id}, {$set: {message:message}});
          await dbClient.close();
          return res.status(200).json({ success: true, message: "Welcome Message Updated" });
        }catch(e){
          console.log('[ERROR] Failed to set welcome message:', e.message);
          return res.status(500).json({ success: false, message: e.message });
        }
      });

      app.post('/api/db/getGroupMessageCount/:chat_id', async (req, res) => {
        try{
          var chat_id = req.params.chat_id;
          if (!chat_id) {
            return res.status(200).json({ success: false, message: 'Missing chat_id' });
          }
          await dbClient.connect();
          var database = dbClient.db(process.env.WP_COLLECTION);
          var GroupMessageCountCollection = database.collection(process.env.GROUP_MESSAGE_COUNT);
          let GroupMessageCountRecord = await GroupMessageCountCollection.findOne({id:chat_id});
          let resp = {};
          if(GroupMessageCountRecord && GroupMessageCountRecord.no_of_message){
            resp = {
              number_of_message: GroupMessageCountRecord.no_of_message,
              level: GroupMessageCountRecord.level
            }
          }else{
            resp = {
              number_of_message: 0,
              level: 0
            }
          }
          await dbClient.close();
          return res.status(200).json({ success: true, data: resp });
          
        }catch(e){
          console.log('[ERROR] Failed to get group message count:', e.message);
          return res.status(500).json({ success: false, message: e.message });
        }
      });


      app.post('/api/db/setGroupMessageCount/:chat_id', async (req, res) => {
        try{
          var chat_id = req.params.chat_id;
          var messageCount = 1;
          await dbClient.connect();
          var database = dbClient.db(process.env.WP_COLLECTION);
          var GroupMessageCountCollection = database.collection(process.env.GROUP_MESSAGE_COUNT);
          let GroupMessageCountRecord = await GroupMessageCountCollection.findOne({id:chat_id});
          if(GroupMessageCountRecord && GroupMessageCountRecord.no_of_message){
            let level = GroupMessageCountRecord.level;
            let number_of_message = GroupMessageCountRecord.no_of_message;
            if(number_of_message >= 100 && number_of_message < 500){
              level = 1;
            }else if(number_of_message >= 500 && number_of_message < 1000){
              level = 2;
            }else if(number_of_message >= 1000 && number_of_message < 2000){
              level = 3;
            }else if(number_of_message >= 2000 && number_of_message < 3000){
              level = 4;
            }else if(number_of_message >= 3000 && number_of_message < 4000){
              level = 5;
            }else if(number_of_message >= 4000 && number_of_message < 5000){
              level = 6;
            }else if(number_of_message >= 5000 && number_of_message < 6000){
              level = 7;
            }else if(number_of_message >= 6000 && number_of_message < 7000){
              level = 8;
            }else if(number_of_message >= 7000 && number_of_message < 8000){
              level = 9;
            }else if(number_of_message >= 8000 && number_of_message < 9000){
              level = 10;
            }else if(number_of_message >= 9000 && number_of_message < 10000){
              level = 11;
            }else if(number_of_message >= 10000 && number_of_message < 11000){
              level = 12;
            }else if(number_of_message >= 11000 && number_of_message < 12000){
              level = 13;
            }else if(number_of_message >= 12000 && number_of_message < 13000){
              level = 14;
            }else if(number_of_message >= 13000 && number_of_message < 14000){
              level = 15;
            }else if(number_of_message >= 14000 && number_of_message < 15000){
              level = 16;
            }else if(number_of_message >= 15000 && number_of_message < 16000){
              level = 17;
            }else if(number_of_message >= 16000 && number_of_message < 17000){
              level = 18;
            }else if(number_of_message >= 17000 && number_of_message < 18000){
              level = 19;
            }
            number_of_message = messageCount + GroupMessageCountRecord.no_of_message;
            await GroupMessageCountCollection.updateOne({id:chat_id}, {$set: {no_of_message:number_of_message, level:level}});
          }
          await dbClient.close();
          return res.status(200).json({ success: true, message: "Group Message Count Updated" });

        }catch(e){
          console.log('[ERROR] Failed to set group message count:', e.message);
          return res.status(500).json({ success: false, message: e.message });
        }
      });

          
      
      const PORT = process.env.PORT || 2228;
      server.listen(PORT, () => {
        date = new Date();
        let info = '[INFO] Server started on port ' + PORT + '! Process environment:' + process.env.NODE_ENV + ' at ' + date;
        console.log(info);
        if (process.env.NODE_ENV == 'production') 
        {
          sendDiscordWebhook(info, 'Server Started', 65280);
        }
      });

};
startServer()
