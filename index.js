const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const config = require('./config/config.js');
const swaggerSetup = require('./config/swagger.js');
const limiter = require('./middleware/rateLimitMiddleware');
const logger = require('./utils/logger.js');
const clashService = require('./services/clashService');
const ApiRoutes = require('./routes/apiRoutes');
const clashAutomation = require('./tasks/clashAutomated');

class Server {
  constructor() {
    this.app = express();
    this.config = config;
    this.initMiddlewares();
    this.initRoutes();
    this.initSwagger();
  }

  validateConfig() {
    const requiredVars = ['port', 'clashApi.username', 'clashApi.password', 'domain'];
    for (const key of requiredVars) {
      const value = key.split('.').reduce((acc, k) => acc && acc[k], this.config);
      if (!value) {
        logger.error(`Missing required configuration: ${key}`);
        process.exit(1);
      }
    }
  }

  initMiddlewares() {
    this.app.use(cors());
    this.app.disable('x-powered-by');
    this.app.set('etag', false);
    this.app.use(express.json());
    this.app.use(helmet());
    this.app.use(limiter); 
  }

  
  initRoutes() {
    const apiRoutes = new ApiRoutes();
    this.app.use('/api', apiRoutes.getRouter());

  }

  
  initSwagger() {
    try {
      swaggerSetup(this.app);
      logger.info('Swagger setup completed successfully');
    } catch (error) {
      logger.error('Failed to set up Swagger:', error);
    }
  }

  
  async start() {
    try {
      await this.initClashClient();
      this.server = this.app.listen(this.config.port, this.onServerStart.bind(this));
      this.handleShutdown();
      await this.runAutomationTasks();
    } catch (error) {
      logger.error('Failed to start server', error);
      process.exit(1);
    }
  }

  
  async initClashClient() {
    const cocEmail = this.config.clashApi.username;
    const cocPassword = this.config.clashApi.password;
    await clashService.init(cocEmail, cocPassword);
  }

  
  onServerStart() {
    const { port, env, domain } = this.config;
    logger.info(`Server is running on port ${port}`);
    logger.info(`Environment: ${env}`);
    logger.info(`Swagger documentation: ${domain}/api-docs`);
  }

  
  async runAutomationTasks() {
    try{
      await clashAutomation.syncClashData();
    }catch(error){
      console.log('error:', error);
      logger.error('Failed to run automation tasks:', error);
    }
  }

  
  handleShutdown() {
    const shutdownHandler = () => this.shutdown();
    process.on('SIGTERM', shutdownHandler);
    process.on('SIGINT', shutdownHandler);
  }

  shutdown() {
    if (this.server) {
      logger.warn('Received shutdown signal, closing server...');
      this.server.close(() => {
        logger.warn('Closed remaining connections');
        process.exit(0);
      });
    }
  }
}

new Server().start();
