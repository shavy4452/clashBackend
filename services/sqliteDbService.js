const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const chalk = require('chalk');


const dbPath = path.join(__dirname, '/../database/');
if (!fs.existsSync(path.dirname(dbPath))) {
    fs.mkdirSync(path.dirname(dbPath));
}


async function startDB(dbName) {
    const db = new sqlite3.Database(dbPath + dbName, (err) => {
        if (err) {
            console.error(chalk.red('[ERROR] Failed to connect to the database:'), err);
            throw err;
        }
        console.log(chalk.green('[INFO] Connected to the database.'));
    });
    return db;
}

async function closeDatabase(db) {
    db.close((err) => {
        if (err) {
            console.error(chalk.red('[ERROR] Failed to close the database connection:'), err);
            throw err;
        }
        console.log(chalk.green('[INFO] Database connection closed.'));
    });
}

async function create(db, query) {
    return new Promise((resolve, reject) =>
        db.run(query, (err) => {
            if (err) {
                reject(err);
            }
            resolve();
        })
    );
}

async function find(db, query) {
    return new Promise((resolve, reject) =>
        db.all(query, (err, rows) => {
            if (err) {
                reject(err);
            }
            resolve(rows);
        })
    );
}

async function findAll(db, query) {
    return new Promise((resolve, reject) =>
        db.all(query, (err, rows) => {
            if (err) {
                reject(err);
            }
            resolve(rows);
        }));
}

async function insert(db, query, params) {
    return new Promise((resolve, reject) =>
        db.run(query, params, (err) => {
            if (err) {
                reject(err);
            }
            resolve();
        })
    );
}

async function update(db, query) {
    return new Promise((resolve, reject) =>
        db.run(query, (err) => {
            if (err) {
                reject(err);
            }
            resolve();
        })
    );
}

async function bulkInsert(db, query, params) {
    return new Promise((resolve, reject) =>
        db.run(query, params, (err) => {
            if (err) {
                reject(err);
            }
            resolve();
        })
    );
}

async function isPreviousSyncCompleted(db) {
    try{
        const query = 'SELECT * FROM sync_info WHERE is_sync_completed = 0;';
        const result = await find(db, query);
        if (result.length === 0) {
            return { isPreviousSyncCompleted: true, syncNo: 0 };
        }
        return { isPreviousSyncCompleted: false, syncNo: result[0].sync_no };
    } catch (err) {
        return { isPreviousSyncCompleted: true, syncNo: 0 };
    }
}

async function isAllSyncCompleted(db, tableName) {
    try{
        const query =`SELECT COUNT(*) AS incompleteCount FROM ${tableName} WHERE is_completed = 0;`;
        const result = await find(db, query);
        if (result.length === 0) {
            return false;
        }
        return result[0].incompleteCount === 0;
    } catch (err) {
        return true;
    }
}

async function performTransaction(db, callback) {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run('BEGIN TRANSACTION;');
            callback(db)
                .then((result) => {
                    db.run('COMMIT;');
                    resolve(result);
                })
                .catch((error) => {
                    db.run('ROLLBACK;');
                    reject(error);
                });
        });
    });
}


async function findTable(db){
    try{
        const query = 'SELECT sync_no FROM sync_info WHERE is_sync_completed = 0';
        const result = await find(db, query);
        if (result.length === 0) {
            return false;
        }
        return "clan_sync_" + result[0].sync_no;
    }catch(err){
        return false;
    }
}

async function ensureAllTableExists (db, type) {
    try{
        var createSyncInfoTableQuery;
        if (type === 'clan') {
            createSyncInfoTableQuery = `
                    CREATE TABLE IF NOT EXISTS sync_info (
                        sync_no INTEGER PRIMARY KEY AUTOINCREMENT,
                        total_number_of_clans INTEGER,
                        is_sync_completed BOOLEAN
                    );
                `;
        }else if(type === 'player'){
            createSyncInfoTableQuery = `
                    CREATE TABLE IF NOT EXISTS sync_info (
                        sync_no INTEGER PRIMARY KEY AUTOINCREMENT,
                        total_number_of_players INTEGER,
                        is_sync_completed BOOLEAN
                    );
                `;
        }
        await create(db, createSyncInfoTableQuery);
        return true;
    }catch(err){
        return false;
    }
}

async function getClanListOfPreviousSync(db, tableName){
    try{
        const query =  `SELECT clanTag FROM ${tableName} WHERE is_completed = 0;`;
        const result = await find(db, query);
        if (result.length === 0) {
            return [];
        }
        return result.map(clan => clan.clanTag);
    }catch(err){
        return [];
    }
}

async function bulkInsertQuery(db, table, columns, data){
    try{
        if (data.length === 0) {
            throw new Error('Data array is empty');
        }
        const values = [];
        let placeholders = data.map((_, i) => {
            const offset = i * columns.length;
            return `(${columns.map((_, j) => `$${offset + j + 1}`).join(', ')})`;
        }).join(', ');

        data.forEach(row => {
            values.push(...Object.values(row));
        });

        const query = `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${placeholders}`;
        await bulkInsert(db, query, values);
        return true;
    }
    catch(err){
        return false;
    }
}
module.exports = {
    startDB,
    closeDatabase,
    create,
    find,
    findAll,
    insert,
    update,
    bulkInsert,
    isPreviousSyncCompleted,
    findTable,
    ensureAllTableExists,
    getClanListOfPreviousSync,
    isAllSyncCompleted,
    performTransaction
};