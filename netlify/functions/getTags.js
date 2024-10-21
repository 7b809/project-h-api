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

    // Check if the route is /tags
    const pathParts = event.path.split('/');
    const lastPathPart = pathParts[pathParts.length - 1];

    if (lastPathPart !== 'tags') {
        return {
            statusCode: 404,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ error: 'Not Found' }),
        };
    }

    // Handle POST request for tags
    if (event.httpMethod === 'POST') {
        try {
            await client.connect();
            const db = client.db('project-h');

            // Parse the request body for tags
            const requestBody = JSON.parse(event.body);
            const tagsList = requestBody.tags.map(tag => tag.toLowerCase()); // Convert tags to lowercase

            const tagsCollection = db.collection('tags_summary'); // Tags collection

            // Fetch tags from the tags_summary collection
            const documents = await tagsCollection.find().toArray(); 

            // Filter tags to find matches in the collection
            const matchingTags = documents.filter(doc => 
                doc.tags && doc.tags.some(tag => tagsList.includes(tag.toLowerCase())) // Case-insensitive comparison
            );

            // Collect serial_number_list for each found tag
            const serialNumbers = [];
            matchingTags.forEach(tagDoc => {
                serialNumbers.push(...tagDoc.serial_number_list);
            });

            // Get unique serial numbers
            const uniqueSerialNumbers = [...new Set(serialNumbers)];

            // Fetch documents from the api-img collection using the unique serial numbers
            const apiCollection = db.collection('api-img');
            const images = await apiCollection.find({ serial_no: { $in: uniqueSerialNumbers } }).toArray(); // Query based on serial_no

            // Check if images were found
            if (images.length > 0) {
                return {
                    statusCode: 200,
                    headers: {
                        'Access-Control-Allow-Origin': '*', // Change this to your domain
                        'Content-Type': 'application/json', // Set content type to JSON
                    },
                    body: JSON.stringify(images), // Send the entire document structure as a response
                };
            } else {
                return {
                    statusCode: 404,
                    headers: {
                        'Access-Control-Allow-Origin': '*', // Change this to your domain
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ error: 'No images found for the provided tags' }),
                };
            }
        } catch (error) {
            return {
                statusCode: 500,
                headers: {
                    'Access-Control-Allow-Origin': '*', // Change this to your domain
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ error: 'Failed to fetch data' }),
            };
        } finally {
            await client.close();
        }
    }

    // For GET request handling (if needed)
    if (event.httpMethod === 'GET') {
        // Here you could implement GET handling if required
        return {
            statusCode: 405, // Method Not Allowed
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }

    return {
        statusCode: 405, // Method Not Allowed
        headers: {
            'Access-Control-Allow-Origin': '*', // Change this to your domain
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Method not allowed' }),
    };
};
