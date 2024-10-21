const { MongoClient } = require('mongodb');

exports.handler = async (event, context) => {
    const mongoUrl = process.env.MONGO_URL; // Use environment variable for MongoDB URL
    const client = new MongoClient(mongoUrl);

    // Allow preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204, // No content
            headers: {
                'Access-Control-Allow-Origin': '*', // Change this to your domain
                'Access-Control-Allow-Credentials': 'true',
                'Access-Control-Allow-Methods': 'GET,HEAD,OPTIONS,POST,PUT',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization', // Add any custom headers you need
            },
        };
    }

    // Check the route
    const pathParts = event.path.split('/');
    const lastPathPart = pathParts[pathParts.length - 1];

    if (lastPathPart === 'tags') {
        if (event.httpMethod === 'GET') {
            try {
                await client.connect();
                const db = client.db('project-h');

                const tagsCollection = db.collection('tags_summary'); // New tags collection
                // Fetch only the "tags" field from the tags_summary collection
                const documents = await tagsCollection.find({}, { projection: { tags: 1 } }).toArray();

                // Check if any documents were found
                if (documents.length === 0) {
                    return {
                        statusCode: 404,
                        headers: {
                            'Access-Control-Allow-Origin': '*', // Change this to your domain
                            'Content-Type': 'application/json', // Set content type to JSON
                        },
                        body: JSON.stringify({ error: 'No documents found' }),
                    };
                }

                // Remove the "_id" field from each document
                const sanitizedDocuments = documents.map(({ _id, ...rest }) => rest);

                return {
                    statusCode: 200,
                    headers: {
                        'Access-Control-Allow-Origin': '*', // Change this to your domain
                        'Content-Type': 'application/json', // Set content type to JSON
                    },
                    body: JSON.stringify(sanitizedDocuments), // Send the sanitized documents as a response
                };
            } catch (error) {
                return {
                    statusCode: 500,
                    headers: {
                        'Access-Control-Allow-Origin': '*', // Change this to your domain
                        'Content-Type': 'application/json', // Set content type to JSON
                    },
                    body: JSON.stringify({ error: 'Failed to fetch data' }),
                };
            } finally {
                await client.close();
            }
        } else if (event.httpMethod === 'POST') {
            try {
                const { tags } = JSON.parse(event.body); // Expecting a JSON body with "tags" field
                if (!Array.isArray(tags)) {
                    return {
                        statusCode: 400,
                        headers: {
                            'Access-Control-Allow-Origin': '*', // Change this to your domain
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ error: 'Invalid input: tags should be an array' }),
                    };
                }

                // Convert tags to lowercase
                const lowercaseTags = tags.map(tag => tag.toLowerCase());

                return {
                    statusCode: 200,
                    headers: {
                        'Access-Control-Allow-Origin': '*', // Change this to your domain
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(lowercaseTags), // Send the lowercase tags as a response
                };
            } catch (error) {
                return {
                    statusCode: 500,
                    headers: {
                        'Access-Control-Allow-Origin': '*', // Change this to your domain
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ error: 'Failed to process input' }),
                };
            }
        }
    }

    return {
        statusCode: 404,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Not Found' }),
    };
};
