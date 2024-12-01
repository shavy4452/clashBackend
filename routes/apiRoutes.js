const express = require('express');
const ClashController = require('../controllers/clashController');
const authenticate = require('../middleware/authMiddleware');
const cachemiddleware = require('../middleware/cacheMiddleware');
const rateLimitMiddleware = require('../middleware/rateLimitMiddleware');
const config = require('../config/config');
const LinkController = require('../controllers/linkController');

class ApiRoutes {
  constructor() {
    this.router = express.Router();
    this.initializeRoutes();
    this.config = config;
    this.isProduction = config.isProduction;
  }



  initializeRoutes() {
    this.router.post('/health', (req, res) => {
      res.status(200).json({ message: 'API is running' });
    });

    this.router.post('/postClanInfo/:tag', 
      authenticate,
      rateLimitMiddleware, 
      this.isProduction ? cachemiddleware(60) : cachemiddleware(0),
      ClashController.postClanData);

    this.router.post('/postClanMembers/:tag',
      authenticate,
      rateLimitMiddleware,
      this.isProduction ? cachemiddleware(60) : cachemiddleware(0),
      ClashController.postClanMembers);

    this.router.post('/postCapitalRaidSeasons/:tag',
      authenticate,
      rateLimitMiddleware,
      this.isProduction ? cachemiddleware(60) : cachemiddleware(0),
      ClashController.postCapitalRaidSeasons);

    this.router.post('/postClanMembersHero/:tag',
      authenticate,
      rateLimitMiddleware,
      this.isProduction ? cachemiddleware(60) : cachemiddleware(0),
      ClashController.postClanMembersHero);

    this.router.post('/postPlayersInfo/:tag'
      , authenticate
      , rateLimitMiddleware
      , this.isProduction ? cachemiddleware(60) : cachemiddleware(0)
      , ClashController.postPlayersInfo);

    this.router.post('/postCurrentWar/:tag'
      , authenticate
      , rateLimitMiddleware
      , this.isProduction ? cachemiddleware(60) : cachemiddleware(0)
      , ClashController.postCurrentWar);

    this.router.post('/postWarLog/:tag'
      , authenticate
      , rateLimitMiddleware
      , this.isProduction ? cachemiddleware(60) : cachemiddleware(0)
      , ClashController.postClanWarLog);

    this.router.post('/postTHLevels/:tag'
      , authenticate
      , rateLimitMiddleware
      , this.isProduction ? cachemiddleware(60) : cachemiddleware(0)
      , ClashController.postTHLevels);

    this.router.post('/postCWLresults/:tag'
      , authenticate
      , rateLimitMiddleware
      , this.isProduction ? cachemiddleware(60) : cachemiddleware(0)
      , ClashController.postCWLresults);

    this.router.post('/postWarWeight/:tag'
      , authenticate
      , rateLimitMiddleware
      , this.isProduction ? cachemiddleware(60) : cachemiddleware(0)
      , ClashController.postWarWeight);

    this.router.post('/db/postRecords/:phoneNumber'
      , authenticate
      , rateLimitMiddleware
      , this.isProduction ? cachemiddleware(60) : cachemiddleware(0)
      , LinkController.postRecords);

    this.router.post('/db/addRecord/:PhoneNumber/:Type/:Tag/:Action'
      , authenticate
      , rateLimitMiddleware
      , this.isProduction ? cachemiddleware(60) : cachemiddleware(0)
      , LinkController.addRecord);

    this.router.post('/clanHistory/:tag'
      , authenticate
      , rateLimitMiddleware
      , ClashController.postClanHistory);

    this.router.post('/clanMembersHistory/:tag'
      , authenticate
      , rateLimitMiddleware
      , ClashController.postClanMembersHistory);

  }

  postRouter() {
    return this.router;
  }
}

module.exports = ApiRoutes;
