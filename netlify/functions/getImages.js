const { MongoClient } = require('mongodb');

exports.handler = async (event, context) => {
    const mongoUrl = process.env.MONGO_URL; // Use environment variable for MongoDB URL
    const client = new MongoClient(mongoUrl);

    // Extract the path from the event object
    const pathParts = event.path.split('/');
    const index = parseInt(pathParts[pathParts.length - 1], 10); // Get the last part of the path

    try {
        await client.connect();
        const db = client.db('project-h');
        const collection = db.collection('api-img');

        if (!isNaN(index)) {
            // If an index is provided in the URL
            const documents = await collection.find().toArray();
            // Check if the index is valid
            if (index < 0 || index >= documents.length) {
                return {
                    statusCode: 404,
                    headers: {
                        'Access-Control-Allow-Origin': '*', // Allow all origins
                    },
                    body: JSON.stringify({ error: 'Document not found' }),
                };
            }
            // Remove the "_id" field from the specified document
            const { _id, ...rest } = documents[index];

            return {
                statusCode: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*', // Allow all origins
                },
                body: JSON.stringify(rest), // Send the sanitized document as a response
            };
        } else {
            // Fetch all documents if no index is provided
            const documents = await collection.find().toArray();
            // Remove the "_id" field from each document
            const sanitizedDocuments = documents.map(({ _id, ...rest }) => rest);

            return {
                statusCode: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*', // Allow all origins
                },
                body: JSON.stringify(sanitizedDocuments), // Send all documents as a response
            };
        }
    } catch (error) {
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*', // Allow all origins
            },
            body: JSON.stringify({ error: 'Failed to fetch data' }),
        };
    } finally {
        await client.close();
    }
};
