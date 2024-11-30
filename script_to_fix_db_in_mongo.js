const { MongoClient } = require('mongodb');
const config = require('./config/config');

// MongoDB Connection URI and Database Details
const uri = config.mongoDB.url;
const dbName = config.mongoDB.collection;
const sourceCollectionName = config.mongoDB.playerDB;
const destinationCollectionName = config.mongoDB.playerDB;

(async () => {
    const client = new MongoClient(uri);

    try {
        // Connect to the database
        await client.connect();
        const db = client.db(dbName);
        const sourceCollection = db.collection(sourceCollectionName);
        const destinationCollection = db.collection(destinationCollectionName);

        console.log("Connected to the database");

        // Fetch all records
        const records = await sourceCollection.find().toArray();
        console.log(`Fetched ${records.length} records from ${sourceCollectionName}`);

        // Process records by ID
        const processedRecords = {};
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

        // Prepare consolidated documents
        const consolidatedDocs = Object.entries(processedRecords).map(([id, tags]) => ({
            id,
            Ctag: Array.from(tags).join(" ") // Convert set back to a string
        }));

        console.log(`Processed ${consolidatedDocs.length} unique records`);

        // Insert processed documents into the destination collection
        await destinationCollection.deleteMany({}); // Clear the destination collection
        await destinationCollection.insertMany(consolidatedDocs);
        console.log(`Inserted ${consolidatedDocs.length} records into ${destinationCollectionName}`);
    } catch (error) {
        console.error("[ERROR]:", error.message);
    } finally {
        await client.close();
        console.log("Database connection closed");
    }
})();
