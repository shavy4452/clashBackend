const  config  = require('../config/config');
const { logApiUsage } = require('../services/usageService');
const jwt = require('jsonwebtoken');

const authenticate = (req, res, next) => {
  try{
    const auth = req.headers['authorization'];
    const newToken = jwt.sign({ owner: 'shavy' }, config.jwt_secret, { expiresIn: '24h' });
    console.log('new token:', newToken);

    if (!auth) {
      return res.status(401).json({ message: 'Authorization header or query parameter is missing' });
    }

    const verifyToken = jwt.verify(auth, config.jwt_secret);


    if (!verifyToken) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    req.owner = verifyToken.owner;
    req.token = auth;
    req.originalUrl = req.originalUrl.replace(/\?.*$/, '');

    if (!req.owner) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    logApiUsage(req.owner, req.originalUrl);
    
    next();

  }catch(err){
    if(err.name === 'TokenExpiredError'){
      return res.status(401).json({ message: 'Token expired' });
    }
    return res.status(401).json({ message: 'Invalid token' });
  }
  

};

module.exports = authenticate;
