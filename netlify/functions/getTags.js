const { MongoClient } = require('mongodb');

exports.handler = async (event, context) => {
    const mongoUrl = process.env.MONGO_URL; // Use environment variable for MongoDB URL
    const client = new MongoClient(mongoUrl);

    // Allow preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204, // No content
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': 'true',
                'Access-Control-Allow-Methods': 'GET,HEAD,OPTIONS,POST,PUT',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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

    // Handle POST request
    if (event.httpMethod === 'POST') {
        let requestBody;
        try {
            requestBody = JSON.parse(event.body);
        } catch (error) {
            return {
                statusCode: 400,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ error: 'Invalid JSON' }),
            };
        }

        const tagsList = requestBody.tags;

        if (!Array.isArray(tagsList) || tagsList.length === 0) {
            return {
                statusCode: 400,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ error: 'Tags must be a non-empty array' }),
            };
        }

        try {
            await client.connect();
            const db = client.db('project-h');
            const imgSummaryCollection = db.collection('img_summary');

        // Find all documents that match the tags in the tagsList
        const results = await imgSummaryCollection.find({
            tags: { $elemMatch: { $in: tagsList.map(tag => tag.toLowerCase()) } } // Using $elemMatch for case-insensitive matching
        }).toArray();


            // Extract serial_number_list from the results
            const serialNumberSets = new Set(); // Using a Set to avoid duplicates

            results.forEach(doc => {
                doc.tag_data.forEach(tagData => {
                    // Only add serial numbers if the tag name matches
                    if (tagsList.includes(tagData.tag_name)) {
                        tagData.serial_number_list.forEach(serialNumber => {
                            serialNumberSets.add(serialNumber); // Add serial number to the Set
                        });
                    }
                });
            });

            // Convert the Set to an array
            const serialNumberList = Array.from(serialNumberSets);

            return {
                statusCode: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ serial_number_list: serialNumberList }),
            };
        } catch (error) {
            return {
                statusCode: 500,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ error: 'Failed to fetch data' }),
            };
        } finally {
            await client.close();
        }
    }

    return {
        statusCode: 405,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
};
