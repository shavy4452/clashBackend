const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const fs = require('fs');
const path = require('path');

class SwaggerSetup {
  constructor(domain) {
    this.domain = domain;
    this.uiOptions = {
      swaggerOptions: {
        supportedSubmitMethods: ['get', 'post'],
      },
    };
  }

  getSwaggerDocs() {
    const swaggerPath = path.resolve(__dirname, '../swaggerDocs/swagger.json');
    const swaggerDocs = JSON.parse(fs.readFileSync(swaggerPath, 'utf8'));
    swaggerDocs.servers = [
      {
        url: `${this.domain}/api`,
      },
    ];
    return swaggerDocs;
  }

  setupSwagger(app) {
    const swaggerDocs = this.getSwaggerDocs();
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs, this.uiOptions));
  }
}

module.exports = (app) => {
  const { domain } = require('./config');
  const swaggerSetup = new SwaggerSetup(domain);
  swaggerSetup.setupSwagger(app);
};
