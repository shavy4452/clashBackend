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
    this.router.get('/health', (req, res) => {
      res.status(200).json({ message: 'API is running' });
    });

    this.router.get('/getClanInfo/:tag', 
      authenticate,
      rateLimitMiddleware, 
      this.isProduction ? cachemiddleware(60) : cachemiddleware(0),
      ClashController.getClanData);

    this.router.get('/getClanMembers/:tag',
      authenticate,
      rateLimitMiddleware,
      this.isProduction ? cachemiddleware(60) : cachemiddleware(0),
      ClashController.getClanMembers);

    this.router.get('/getCapitalRaidSeasons/:tag',
      authenticate,
      rateLimitMiddleware,
      this.isProduction ? cachemiddleware(60) : cachemiddleware(0),
      ClashController.getCapitalRaidSeasons);

    this.router.get('/getClanMembersHero/:tag',
      authenticate,
      rateLimitMiddleware,
      this.isProduction ? cachemiddleware(60) : cachemiddleware(0),
      ClashController.getClanMembersHero);

    this.router.get('/getPlayersInfo/:tag'
      , authenticate
      , rateLimitMiddleware
      , this.isProduction ? cachemiddleware(60) : cachemiddleware(0)
      , ClashController.getPlayersInfo);

    this.router.get('/getCurrentWar/:tag'
      , authenticate
      , rateLimitMiddleware
      , this.isProduction ? cachemiddleware(60) : cachemiddleware(0)
      , ClashController.getCurrentWar);

    this.router.get('/getWarLog/:tag'
      , authenticate
      , rateLimitMiddleware
      , this.isProduction ? cachemiddleware(60) : cachemiddleware(0)
      , ClashController.getClanWarLog);

    this.router.get('/getTHLevels/:tag'
      , authenticate
      , rateLimitMiddleware
      , this.isProduction ? cachemiddleware(60) : cachemiddleware(0)
      , ClashController.getTHLevels);

    this.router.get('/getCWLresults/:tag'
      , authenticate
      , rateLimitMiddleware
      , this.isProduction ? cachemiddleware(60) : cachemiddleware(0)
      , ClashController.getCWLresults);

    this.router.get('/getWarWeight/:tag'
      , authenticate
      , rateLimitMiddleware
      , this.isProduction ? cachemiddleware(60) : cachemiddleware(0)
      , ClashController.getWarWeight);

    this.router.get('/db/getRecords/:phoneNumber'
      , authenticate
      , rateLimitMiddleware
      , this.isProduction ? cachemiddleware(60) : cachemiddleware(0)
      , LinkController.getRecords);

    this.router.get('/db/addRecord/:PhoneNumber/:Type/:Tag/:Action'
      , authenticate
      , rateLimitMiddleware
      , this.isProduction ? cachemiddleware(60) : cachemiddleware(0)
      , LinkController.addRecord);

    this.router.get('/clanHistory/:tag'
      , authenticate
      , rateLimitMiddleware
      , ClashController.getClanHistory);

    this.router.get('/clanMembersHistory/:tag'
      , authenticate
      , rateLimitMiddleware
      , ClashController.getClanMembersHistory);

  }

  getRouter() {
    return this.router;
  }
}

module.exports = ApiRoutes;
