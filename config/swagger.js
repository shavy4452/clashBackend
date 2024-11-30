const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const { domain } = require('./config');

class SwaggerSetup {
  constructor(domain) {
    this.domain = domain;
    this.swaggerOptions = {
      swaggerDefinition: {
        openapi: '3.0.0',
        info: {
          title: 'API Documentation',
          version: '1.0.0',
          description: 'API Documentation for Clash of Clans and related data services',
          contact: {
            name: 'Shavy',
            email: 'mailto:shavygaming@gmail.com',
          },
        },
        servers: [
          {
            url: `${this.domain}/api`,
          },
        ],
        tags: [
          {
            name: 'Health',
            description: 'Health check endpoint',
          },
          {
            name: 'Clan Endpoints',
            description: 'Endpoints for fetching clan data',
          },
          {
            name: 'War Endpoints',
            description: 'Endpoints for war-related data',
          },
          {
            name: 'Player Endpoints',
            description: 'Endpoints for player-related data',
          },
          {
            name: 'Database Operations',
            description: 'Endpoints for database records',
          },
        ],
        components: {
          securitySchemes: {
            ApiKeyAuth: {
              type: 'apiKey',
              in: 'header',
              name: 'authorization',
              description: 'JWT token for authentication',
            },
          },
        },
        security: [
          {
            ApiKeyAuth: [],
          },
        ],
      },
      apis: ['./swaggerDocs/*.js'], // Updated to load annotations from `swaggerDocs` folder
    };
    

    this.uiOptions = {
      swaggerOptions: {
        supportedSubmitMethods: ['get', 'post'],
      },
    };
  }

  getSwaggerDocs() {
    return swaggerJsDoc(this.swaggerOptions);
  }

  setupSwagger(app) {
    const swaggerDocs = this.getSwaggerDocs();
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs, this.uiOptions));
  }
}

module.exports = (app) => {
  const swaggerSetup = new SwaggerSetup(domain);
  swaggerSetup.setupSwagger(app);
};
