// netlify/functions/getImages.js
const { MongoClient } = require('mongodb');

exports.handler = async (event, context) => {
    const mongoUrl = process.env.MONGO_URL; // Use environment variable for MongoDB URL
    const client = new MongoClient(mongoUrl);
    
    try {
        await client.connect();
        const db = client.db('project-h');
        const collection = db.collection('api-img');

        // Fetch all documents in the collection
        const documents = await collection.find().toArray();

        // Remove the "_id" field from each document
        const sanitizedDocuments = documents.map(({ _id, ...rest }) => rest);

        return {
            statusCode: 200,
            body: JSON.stringify(sanitizedDocuments),
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to fetch data' }),
        };
    } finally {
        await client.close();
    }
};
