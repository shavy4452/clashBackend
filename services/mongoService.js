const { MongoClient } = require('mongodb');
const logger = require('../utils/logger'); 
const config = require('../config/config');


// MongoDB URI (replace with your MongoDB URI from Atlas or cloud service)
const mongoURI = config.mongoDB.url;

class MongoService {
    constructor() {
        this.client = new MongoClient(mongoURI);
        this.client2 = new MongoClient(config.bandCreds);
        this.db = null;
        this.db2 = null;
    }

    /**
     * Connect to MongoDB
     */
    async connect() {
        try {

            await this.client.connect();
            this.db = this.client.db(config.mongoDB.collection);
            logger.info('MongoDB connected successfully');
        } catch (error) {
            console.log('error:', error);
            logger.error('MongoDB connection error:', error);
            process.exit(1);  // Exit the process on connection failure
        }
    }

    /**
     * Disconnect from MongoDB
     */
    async disconnect() {
        try {
            await this.client.close();
            logger.info('MongoDB disconnected successfully');
        } catch (error) {
            logger.error('MongoDB disconnection error:', error);
        }
    }

    /**
     * Get a collection from MongoDB
     * @param {string} collectionName - The collection name
     * @returns {Collection} The collection object
     */
    getCollection(collectionName) {
        if (!this.db) {
            throw new Error('Database is not connected');
        }
        return this.db.collection(collectionName);
    }

    /**
     * Insert a new document into a collection
     * @param {string} collectionName - The collection name
     * @param {Object} document - The document to insert
     * @returns {Object} The inserted document
     */
    async insertOne(collectionName, document) {
        try {
            const collection = this.getCollection(collectionName);
            const result = await collection.insertOne(document);
            return result.ops[0];  // Return the inserted document
        } catch (error) {
            logger.error('Error inserting document:', error);
            throw error;
        }
    }

    /**
     * Find documents in a collection
     * @param {string} collectionName - The collection name
     * @param {Object} query - The query filter
     * @param {Object} projection - Optional projection for fields
     * @returns {Array} The documents found
     */
    async find(collectionName, query = {}, projection = {}) {
        try {
            const collection = this.getCollection(collectionName);
            const documents = await collection.find(query).project(projection).toArray();
            return documents;
        } catch (error) {
            logger.error('Error finding documents:', error);
            throw error;
        }
    }

    /**
     * Find one document in a collection
     * @param {string} collectionName - The collection name
     * @param {Object} projection - Optional projection for fields
     * @returns {Object} The document found
     */
    async findOne(collectionName, projection = {}) {
        try {
            const collection = this.getCollection(collectionName);
            const document = await collection.findOne(projection || {});
            return document;
        } catch (error) {
            logger.error('Error finding document:', error);
            throw error;
        }
    }

    /**
     * Update a document in a collection
     * @param {string} collectionName - The collection name
     * @param {Object} query - The query filter
     * @param {Object} update - The update data
     * @returns {Object} The updated document
     */
    async updateOne(collectionName, query, update) {
        try {
            const collection = this.getCollection(collectionName);
            const result = await collection.updateOne(query, { $set: update });
            return result;
        } catch (error) {
            logger.error('Error updating document:', error);
            throw error;
        }
    }

    /**
     * Delete a document in a collection
     * @param {string} collectionName - The collection name
     * @param {Object} query - The query filter
     * @returns {Object} The result of the delete operation
     */
    async deleteOne(collectionName, query) {
        try {
            const collection = this.getCollection(collectionName);
            const result = await collection.deleteOne(query);
            return result;
        } catch (error) {
            logger.error('Error deleting document:', error);
            throw error;
        }
    }

    /**
     *  Get Band Credentials
     */
    async getCredentialBand(){
        try{
            await this.client2.connect();
            this.db2 = this.client2.db('Band');
            const col = this.db2.collection("Creds");
            const result = await col.findOne({ _id: 0 });
            return result;
        }catch(error){
            logger.error('MongoDB connection error:', error);
            process.exit(1);
        }
    }
}

module.exports = new MongoService();
