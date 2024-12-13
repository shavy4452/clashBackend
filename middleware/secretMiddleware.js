const  config  = require('../config/config');
const { logApiUsage } = require('../services/usageService');
const jwt = require('jsonwebtoken');
const db = require('../services/mysqldbService.js');
const logger = require('../utils/logger.js');


const secret = (req, res, next) => {
    try{
        const auth = req.headers['secret'];

        if (!auth) {
            return res.status(401).json({ message: 'Secret header is missing' });
        }

        const isTokenInDB = db.execute('SELECT * FROM admin_tokens WHERE token = ?', [auth]);

        if (!isTokenInDB) {
            return res.status(401).json({ message: 'Invalid secret' });
        }

        try{
            const data = jwt.verify(auth, config.jwt_secret);
            req.user_name = data.user_email.split('@')[0];
        }catch(err){
            if(err.name === 'TokenExpiredError') {
                return res.status(401).json({ message: 'Token has expired' });
            }
            return res.status(401).json({ message: 'Invalid secret' });
        }
    }catch(err){
        return res.status(401).json({ message: 'Invalid secret' });
    }
    next();
}

module.exports = secret;