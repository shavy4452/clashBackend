const express = require('express');
const ClashController = require('../controllers/clashController');
const authenticate = require('../middleware/authMiddleware');
const cachemiddleware = require('../middleware/cacheMiddleware');
const rateLimitMiddleware = require('../middleware/rateLimitMiddleware');
const config = require('../config/config');
const LinkController = require('../controllers/linkController');
const AdminController = require('../controllers/adminController');
const jwt = require('jsonwebtoken');
const secret = require('../middleware/secretMiddleware');
const BandController = require('../controllers/bandController');

class ApiRoutes {
  constructor() {
    this.router = express.Router();
    this.initializeRoutes();
    this.config = config;
    this.isProduction = config.isProduction;
  }



  initializeRoutes() {
    this.router.get('/health', (req, res) => {
      ClashController.healthCheck(req, res);
    });

    this.router.post('/generateToken', (req, res) => {
      var generateToken = jwt.sign({ owner: req.body.owner }, req.body.token, { expiresIn: '24h' });
      res.status(200).json({ token: generateToken });
    });

    this.router.post('/getClanInfo/:tag', 
      authenticate,
      rateLimitMiddleware, 
      // this.isProduction ? cachemiddleware(60) : cachemiddleware(0),
      ClashController.getClanData);

    this.router.post('/getClanMembers/:tag',
      authenticate,
      rateLimitMiddleware,
      // this.isProduction ? cachemiddleware(60) : cachemiddleware(0),
      ClashController.getClanMembers);

    this.router.post('/getCapitalRaidSeasons/:tag',
      authenticate,
      rateLimitMiddleware,
      // this.isProduction ? cachemiddleware(60) : cachemiddleware(0),
      ClashController.getCapitalRaidSeasons);

    this.router.post('/getClanMembersHero/:tag',
      authenticate,
      rateLimitMiddleware,
      // this.isProduction ? cachemiddleware(60) : cachemiddleware(0),
      ClashController.getClanMembersHero);

    this.router.post('/getPlayersInfo/:tag'
      , authenticate
      , rateLimitMiddleware
      //,  this.isProduction ? cachemiddleware(60) : cachemiddleware(0),
      , ClashController.getPlayersInfo);

    this.router.post('/getPlayersHistory/:tag'
      , authenticate
      , rateLimitMiddleware
      //,  this.isProduction ? cachemiddleware(60) : cachemiddleware(0),
      , ClashController.getPlayersHistory);

    this.router.post('/getTrackedClanWars/:tag'
      , authenticate
      , rateLimitMiddleware
      //,  this.isProduction ? cachemiddleware(60) : cachemiddleware(0),
      , ClashController.getTrackedClanWars);

    this.router.post('/getCurrentWar/:tag'
      , authenticate
      , rateLimitMiddleware
      //,  this.isProduction ? cachemiddleware(60) : cachemiddleware(0),
      , ClashController.getCurrentWar);

    this.router.post('/getWarLog/:tag'
      , authenticate
      , rateLimitMiddleware
      //,  this.isProduction ? cachemiddleware(60) : cachemiddleware(0),
      , ClashController.getClanWarLog);

    this.router.post('/getTHLevels/:tag'
      , authenticate
      , rateLimitMiddleware
      //,  this.isProduction ? cachemiddleware(60) : cachemiddleware(0),
      , ClashController.getTHLevels);

    this.router.post('/getCWLresults/:tag'
      , authenticate
      , rateLimitMiddleware
      //,  this.isProduction ? cachemiddleware(60) : cachemiddleware(0),
      , ClashController.getCWLresults);

    this.router.post('/getWarWeight/:tag'
      , authenticate
      , rateLimitMiddleware
      //,  this.isProduction ? cachemiddleware(60) : cachemiddleware(0),
      , ClashController.getWarWeight);

    this.router.post('/db/getRecords/:phoneNumber'
      , authenticate
      , rateLimitMiddleware
      //,  this.isProduction ? cachemiddleware(60) : cachemiddleware(0),
      , LinkController.getRecords);

    this.router.post('/db/addRecord/:PhoneNumber/:Type/:Tag/:Action'
      , authenticate
      , rateLimitMiddleware
      //,  this.isProduction ? cachemiddleware(60) : cachemiddleware(0),
      , LinkController.addRecord);

    this.router.post('/clanHistory/:tag'
      , authenticate
      , rateLimitMiddleware
      //,  this.isProduction ? cachemiddleware(60) : cachemiddleware(0),
      , ClashController.getClanHistory);

    this.router.post('/clanMembersHistory/:tag'
      , authenticate
      , rateLimitMiddleware
      //,  this.isProduction ? cachemiddleware(60) : cachemiddleware(0),
      , ClashController.getClanMembersHistory);

    this.router.post('/getClanRankingsFromLocation/:locationId'
      , authenticate
      , rateLimitMiddleware
      //,  this.isProduction ? cachemiddleware(60) : cachemiddleware(0),
      , ClashController.getClanRankingsFromLocation);

    this.router.post('/getLocations',
      authenticate,
      rateLimitMiddleware,
      // this.isProduction ? cachemiddleware(60) : cachemiddleware(0),
      ClashController.getLocations);

    this.router.post('/getPlayersRankingsFromLocation/:locationId'
      , authenticate
      , rateLimitMiddleware
      //,  this.isProduction ? cachemiddleware(60) : cachemiddleware(0),
      , ClashController.getPlayersRankingsFromLocation);

    this.router.post('/get/ClanAssociation/:tag'
      , authenticate
      , rateLimitMiddleware
      //,  this.isProduction ? cachemiddleware(60) : cachemiddleware(0),
      , ClashController.getClanAssociation);

    this.router.post('/add/ClanAssociation/:tag'
      , authenticate
      , secret
      , rateLimitMiddleware
      //,  this.isProduction ? cachemiddleware(60) : cachemiddleware(0),
      , ClashController.addClanAssociation);

    this.router.post('/getPlayerStatus/:tag'
      , authenticate
      , rateLimitMiddleware
      //,  this.isProduction ? cachemiddleware(60) : cachemiddleware(0),
      , ClashController.getPlayerStatus);

    this.router.post('/addPlayerStatus/:tag'
      , authenticate
      , secret
      , rateLimitMiddleware
      //,  this.isProduction ? cachemiddleware(60) : cachemiddleware(0),
      , ClashController.addPlayerNotes);

    this.router.post('/getClansByLeague/:league'
      , authenticate
      , rateLimitMiddleware
      //,  this.isProduction ? cachemiddleware(60) : cachemiddleware(0),
      , ClashController.getClansByLeague);

    this.router.post('/register',
      authenticate,
      rateLimitMiddleware,
      // this.isProduction ? cachemiddleware(60) : cachemiddleware(0),
      AdminController.register);

    this.router.post('/login',
      authenticate,
      rateLimitMiddleware,
      // this.isProduction ? cachemiddleware(60) : cachemiddleware(0),
      AdminController.login);

    this.router.post('/logout',
      authenticate,
      rateLimitMiddleware,
      // this.isProduction ? cachemiddleware(60) : cachemiddleware(0),
      AdminController.logout);

    this.router.post('/validateToken',
      authenticate,
      rateLimitMiddleware,
      // this.isProduction ? cachemiddleware(60) : cachemiddleware(0),
      AdminController.validateToken);

    this.router.get('/createSyncNotificationBand/:bandNo',
      authenticate,
      rateLimitMiddleware,
      // this.isProduction ? cachemiddleware(60) : cachemiddleware(0),
      BandController.createSyncBandPost);

    this.router.get('/getTrackedWar/:tag'
      , authenticate
      , rateLimitMiddleware
      //,  this.isProduction ? cachemiddleware(60) : cachemiddleware(0),
      , ClashController.getTrackedWar);

    this.router.get('/getClanOfALeague/:league'
      , authenticate
      , rateLimitMiddleware
      //,  this.isProduction ? cachemiddleware(60) : cachemiddleware(0),
      , ClashController.getClanOfALeague);

  }

  getRouter() {
    return this.router;
  }
}

module.exports = ApiRoutes;
