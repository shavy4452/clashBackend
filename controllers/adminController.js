const logger = require('../utils/logger.js');
const chalk = require('chalk');
const db = require('../services/mysqldbService.js');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const  config  = require('../config/config');

class AdminController {
    
    static async register(req, res) {
        try {
            const { user_email, user_password } = req.body;
            if (!user_email || !user_password) {
                return res.status(200).json({ success: false, message: 'Please provide email and password' });
            }
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user_email)) {
                return res.status(200).json({ success: false, message: 'Invalid email address' });
            }

            if (!/^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/.test(user_password)) {
                return res.status(200).json({ success: false, message: 'Password should be at least 8 characters long and contain at least one number and one special character' });
            }

            const userExists = await db.execute('SELECT * FROM admins WHERE user_email = ?', [user_email]);
            if (userExists.length > 0) {
                return res.status(200).json({ success: false, message: 'Email already exists' });
            }

            const hashedPassword = await bcrypt.hash(user_password, 10);
            const newUser = await db.execute('INSERT INTO admins (user_email, user_password, status, level, created_at) VALUES (?, ?, ?, ?, ?)', [user_email, hashedPassword, 'PENDING_APPROVAL', 'ADMIN', new Date()]);
            if (newUser.affectedRows === 1) {
                return res.status(200).json({ success: true, message: 'User registered successfully' });
            } else {
                return res.status(200).json({ success: false, message: 'User registration failed' });
            }

        } catch (error) {
            logger.error(error);
            res.status(200).json({ success: false, message: 'An error occurred while registering user' });
        }
    }

    static async login(req, res) {
        try {
            const { user_email, user_password } = req.body;
            if (!user_email || !user_password) {
                return res.status(200).json({ success: false, message: 'Please provide email and password' });
            }
            const user = await db.execute('SELECT * FROM admins WHERE user_email = ?', [user_email]);
            if (user.length === 0) {
                return res.status(200).json({ success: false, message: 'Invalid email or password' });
            }

            if(user[0].no_of_failed_login_attempts >= 5) {
                return res.status(200).json({ success: false, message: 'User account is locked' });
            }

            const passwordMatch = await bcrypt.compare(user_password, user[0].user_password);
            if (!passwordMatch) {
                var loginAttempts = user[0].no_of_failed_login_attempts  || 0;
                loginAttempts = parseInt(loginAttempts) + 1;
                await db.execute('UPDATE admins SET no_of_failed_login_attempts = ? WHERE user_email = ?', [loginAttempts, user_email]);
                return res.status(200).json({ success: false, message: 'Invalid email or password' });
            }
            
            if (user[0].status !== 'ACTIVE') {
                return res.status(200).json({ success: false, message: 'User is not approved yet or has been suspended' });
            }
            const tokenPaylod = {
                user_email: user[0].user_email,
                user_id: user[0].id,
                user_level: user[0].level
            };
            const token = jwt.sign(
                tokenPaylod, 
                config.jwt_secret,
                { expiresIn: '1h', algorithm: 'HS256' });
            
            var sqlQuery = 'INSERT INTO admin_tokens (user_id, token, created_at) VALUES (?, ?, ?)';
            var result = await db.execute(sqlQuery, [user[0].id, token, new Date()]);

            if (result.affectedRows !== 1) {
                return res.status(200).json({ success: false, message: 'An error occurred while logging in' });
            }

            var deleteOldTokensQuery = 'DELETE FROM admin_tokens WHERE user_id = ? AND token != ?';
            await db.execute(deleteOldTokensQuery, [user[0].id, token]);

            await db.execute('UPDATE admins SET no_of_failed_login_attempts = 0 AND last_logged_in = ? WHERE user_email = ?', [new Date(), user_email]);

            await db.execute('INSERT INTO adminloginlogs (admin_id, login_ip, login_agent, loggedin_at) VALUES (?, ?, ?, ?)', [user[0].id, req.ip, req.headers['user-agent'], new Date()]);

            return res.status(200).json({ success: true, message: 'User logged in successfully' , token: token , userRole: user[0].level});
        } catch (error) {
            logger.error(error);
            res.status(200).json({ success: false, message: 'An error occurred while logging in' });
        }
    }

    static async logout(req, res) {
        try {
            const token = req.headers.secret;
            var tokenExists = await db.execute('SELECT * FROM admin_tokens WHERE token = ?', [token]);
            if (tokenExists.length === 0) {
                return res.status(200).json({ success: false, message: 'Invalid token' });
            }
            var result = await db.execute('DELETE FROM admin_tokens WHERE token = ?', [token]);
            if(result.affectedRows !== 1) {
                return res.status(200).json({ success: false, message: 'The user is not logged in' });
            }
            return res.status(200).json({ success: true, message: 'User logged out successfully' });
        } catch (error) {
            logger.error(error);
            res.status(200).json({ success: false, message: 'An error occurred while logging out' });
        }
    }

    static async validateToken(req, res) {
        try{
            const token = req.headers.secret;
            const tokenExists = await db.execute('SELECT * FROM admin_tokens WHERE token = ?', [token]);
            if (tokenExists.length === 0) {
                return res.status(200).json({ success: false, message: 'Invalid token' });
            }
            try{
                jwt.verify(token, config.jwt_secret);
            }
            catch(error){
                if(error.name === 'TokenExpiredError') {
                    return res.status(200).json({ success: false, message: 'Token has expired' });
                }
                return res.status(200).json({ success: false, message: 'Invalid token' });
            }
            return res.status(200).json({ success: true, message: 'Token is valid' });
        }catch(error){
            logger.error(error);
            res.status(200).json({ success: false, message: 'An error occurred while validating token' });
        }
    }
}



module.exports = AdminController;