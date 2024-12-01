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

    this.router.post('/getClanInfo/:tag', 
      authenticate,
      rateLimitMiddleware, 
      this.isProduction ? cachemiddleware(60) : cachemiddleware(0),
      ClashController.getClanData);

    this.router.post('/getClanMembers/:tag',
      authenticate,
      rateLimitMiddleware,
      this.isProduction ? cachemiddleware(60) : cachemiddleware(0),
      ClashController.getClanMembers);

    this.router.post('/getCapitalRaidSeasons/:tag',
      authenticate,
      rateLimitMiddleware,
      this.isProduction ? cachemiddleware(60) : cachemiddleware(0),
      ClashController.getCapitalRaidSeasons);

    this.router.post('/getClanMembersHero/:tag',
      authenticate,
      rateLimitMiddleware,
      this.isProduction ? cachemiddleware(60) : cachemiddleware(0),
      ClashController.getClanMembersHero);

    this.router.post('/getPlayersInfo/:tag'
      , authenticate
      , rateLimitMiddleware
      , this.isProduction ? cachemiddleware(60) : cachemiddleware(0)
      , ClashController.getPlayersInfo);

    this.router.post('/getCurrentWar/:tag'
      , authenticate
      , rateLimitMiddleware
      , this.isProduction ? cachemiddleware(60) : cachemiddleware(0)
      , ClashController.getCurrentWar);

    this.router.post('/getWarLog/:tag'
      , authenticate
      , rateLimitMiddleware
      , this.isProduction ? cachemiddleware(60) : cachemiddleware(0)
      , ClashController.getClanWarLog);

    this.router.post('/getTHLevels/:tag'
      , authenticate
      , rateLimitMiddleware
      , this.isProduction ? cachemiddleware(60) : cachemiddleware(0)
      , ClashController.getTHLevels);

    this.router.post('/getCWLresults/:tag'
      , authenticate
      , rateLimitMiddleware
      , this.isProduction ? cachemiddleware(60) : cachemiddleware(0)
      , ClashController.getCWLresults);

    this.router.post('/getWarWeight/:tag'
      , authenticate
      , rateLimitMiddleware
      , this.isProduction ? cachemiddleware(60) : cachemiddleware(0)
      , ClashController.getWarWeight);

    this.router.post('/db/getRecords/:phoneNumber'
      , authenticate
      , rateLimitMiddleware
      , this.isProduction ? cachemiddleware(60) : cachemiddleware(0)
      , LinkController.getRecords);

    this.router.post('/db/addRecord/:PhoneNumber/:Type/:Tag/:Action'
      , authenticate
      , rateLimitMiddleware
      , this.isProduction ? cachemiddleware(60) : cachemiddleware(0)
      , LinkController.addRecord);

    this.router.post('/clanHistory/:tag'
      , authenticate
      , rateLimitMiddleware
      , ClashController.getClanHistory);

    this.router.post('/clanMembersHistory/:tag'
      , authenticate
      , rateLimitMiddleware
      , ClashController.getClanMembersHistory);

  }

  getRouter() {
    return this.router;
  }
}

module.exports = ApiRoutes;
