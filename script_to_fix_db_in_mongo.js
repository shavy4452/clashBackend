const { MongoClient } = require('mongodb');
const config = require('./config/config');

// MongoDB Connection URI and Database Details
const uri = config.mongoDB.url;
const dbName = config.mongoDB.collection;
const sourceCollectionName = config.mongoDB.clanDB;
const destinationCollectionName = config.mongoDB.clanDB;
const sourcePlayerCollectionName = config.mongoDB.playerDB;
const destinationPlayerCollectionName = config.mongoDB.playerDB;

(async () => {
    const client = new MongoClient(uri);

    try {
        // Connect to the database
        await client.connect();
        const db = client.db(dbName);
        const sourceCollection = db.collection(sourceCollectionName);
        const destinationCollection = db.collection(destinationCollectionName);
        const sourcePlayerCollection = db.collection(sourcePlayerCollectionName);
        const destinationPlayerCollection = db.collection(destinationPlayerCollectionName);


        console.log("Connected to the database");

        // Fetch all records
        const records = await sourceCollection.find().toArray();
        const playerRecords = await sourcePlayerCollection.find().toArray();
        console.log(`Fetched ${records.length} records from ${sourceCollectionName}`);
        console.log(`Fetched ${playerRecords.length} records from ${sourcePlayerCollectionName}`);

        // Process records by ID
        const processedRecords = {};
        const processedPlayerRecords = {};
        for (const record of records) {
            const id = record.id;
            const ctag = record.Ctag || "";

            if (!processedRecords[id]) {
                processedRecords[id] = new Set(); // Use a set to handle duplicates
            }

            // Add uppercase `Ctag` values to the set
            const tags = ctag.split(" ").map(tag => tag.toUpperCase().trim()).filter(Boolean);
            tags.forEach(tag => processedRecords[id].add(tag));
        }
        for (const playerRecord of playerRecords) {
            const id = playerRecord.id;
            const ctag = playerRecord.Ctag || "";

            if (!processedPlayerRecords[id]) {
                processedPlayerRecords[id] = new Set(); // Use a set to handle duplicates
            }

            // Add uppercase `Ctag` values to the set
            const tags = ctag.split(" ").map(tag => tag.toUpperCase().trim()).filter(Boolean);
            tags.forEach(tag => processedPlayerRecords[id].add(tag));
        }

        // Prepare consolidated documents
        const consolidatedDocs = Object.entries(processedRecords).map(([id, tags]) => ({
            id,
            Ctag: Array.from(tags).join(" ") // Convert set back to a string
        }));

        const consolidatedPlayerDocs = Object.entries(processedPlayerRecords).map(([id, tags]) => ({
            id,
            Ctag: Array.from(tags).join(" ") // Convert set back to a string
        }));

        console.log(`Processed ${consolidatedDocs.length} unique records`);
        console.log(`Processed ${consolidatedPlayerDocs.length} unique records`);

        // Insert processed documents into the destination collection
        await destinationCollection.deleteMany({}); // Clear the destination collection
        await destinationPlayerCollection.deleteMany({}); // Clear the destination collection
        await destinationCollection.insertMany(consolidatedDocs);
        await destinationPlayerCollection.insertMany(consolidatedPlayerDocs);
        console.log(`Inserted ${consolidatedDocs.length} records into ${destinationCollectionName}`);
        console.log(`Inserted ${consolidatedPlayerDocs.length} records into ${destinationPlayerCollectionName}`);
    } catch (error) {
        console.error("[ERROR]:", error.message);
    } finally {
        await client.close();
        console.log("Database connection closed");
    }
})();
