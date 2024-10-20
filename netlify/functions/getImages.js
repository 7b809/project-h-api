const { MongoClient } = require('mongodb');

exports.handler = async (event, context) => {
    const mongoUrl = process.env.MONGO_URL; // Use environment variable for MongoDB URL
    const client = new MongoClient(mongoUrl);

    // Allow preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204, // No content
            headers: {
                'Access-Control-Allow-Origin': 'http://localhost:5500', // Change this to your domain
                'Access-Control-Allow-Credentials': 'true',
                'Access-Control-Allow-Methods': 'GET,HEAD,OPTIONS,POST,PUT',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization', // Add any custom headers you need
            },
        };
    }

    // Extract the path from the event object
    const pathParts = event.path.split('/');
    const pageNumber = parseInt(pathParts[pathParts.length - 1], 10); // Get the last part of the path
    const limit = 40; // Number of documents to return per page
    const skip = pageNumber ? (pageNumber - 1) * limit : 0; // Calculate the number of documents to skip

    try {
        await client.connect();
        const db = client.db('project-h');
        const collection = db.collection('api-img');

        // Fetch documents with pagination
        const documents = await collection.find({})
            .skip(skip)        // Skip the first 'skip' documents
            .limit(limit)      // Limit the results to 'limit' documents
            .toArray();        // Convert the result to an array
        
        // Check if any documents were found
        if (documents.length === 0) {
            return {
                statusCode: 404,
                headers: {
                    'Access-Control-Allow-Origin': 'http://localhost:5500', // Change this to your domain
                    'Content-Type': 'application/json', // Set content type to JSON
                },
                body: JSON.stringify({ error: 'No documents found for this page' }),
            };
        }

        // Remove the "_id" field from each document
        const sanitizedDocuments = documents.map(({ _id, ...rest }) => rest);

        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': 'http://localhost:5500', // Change this to your domain
                'Content-Type': 'application/json', // Set content type to JSON
            },
            body: JSON.stringify(sanitizedDocuments), // Send the sanitized documents as a response
        };
    } catch (error) {
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': 'http://localhost:5500', // Change this to your domain
                'Content-Type': 'application/json', // Set content type to JSON
            },
            body: JSON.stringify({ error: 'Failed to fetch data' }),
        };
    } finally {
        await client.close();
    }
};
