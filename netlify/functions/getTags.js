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

    // Split the path to determine the route
    const pathParts = event.path.split('/');
    const lastPathPart = pathParts[pathParts.length - 1];

    // Handle GET request for /tags
    if (lastPathPart === 'tags' && event.httpMethod === 'GET') {
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
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(sanitizedDocuments), // Return sanitized documents
            };
        } catch (error) {
            return {
                statusCode: 500,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ error: 'Failed to fetch tags data' }),
            };
        } finally {
            await client.close();
        }
    }

    // Handle POST request for /tags/tags-data/{pageNumber}
    if (lastPathPart.startsWith('tags-data/') && event.httpMethod === 'POST') {
        // Extract page number from the URL
        const pageNumber = parseInt(lastPathPart.split('/')[2], 10);

        if (isNaN(pageNumber) || pageNumber < 1) {
            return {
                statusCode: 400,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ error: 'Invalid page number' }),
            };
        }

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
            const imgSummaryCollection = db.collection('tags_summary');
            const apiImgCollection = db.collection('api-img'); // Replace with your database and collection names

            // Create a set to hold unique serial numbers
            const serialNumberSets = new Set(); // Using a set to avoid duplicates

            // Iterate through each tag in tagsList
            for (const tag of tagsList) {
                // Find all documents that match the current tag (case-sensitive matching)
                const results = await imgSummaryCollection.find({ 'tag_data.tag_name': tag }).toArray();

                // Process each document found
                for (const doc of results) {
                    for (const tagData of doc.get('tag_data', [])) {
                        // Check if tagData's tag_name matches the current tag
                        if (tagData.tag_name === tag) {
                            // Add each serial number to the set
                            tagData.serial_number_list.forEach(serialNumber => {
                                serialNumberSets.add(serialNumber); // Add serial number to the Set
                            });
                        }
                    }
                }
            }

            // Convert the Set to an array
            const serialNumberList = Array.from(serialNumberSets);

            // Calculate start and end indices for pagination
            const startIndex = (pageNumber - 1) * 40;
            const endIndex = startIndex + 40;

            // Get the desired serial numbers for the current page
            const paginatedSerialNumbers = serialNumberList.slice(startIndex, endIndex);

            // Create a list to hold the data for the serial numbers on the current page
            const apiDataList = [];

            // Fetch data for each serial number from the api-img collection
            for (const serialNo of paginatedSerialNumbers) {
                // Find the document with the matching serial number
                const apiData = await apiImgCollection.findOne({ serial_no: serialNo });

                // If data is found, remove the '_id' and add it to the list
                if (apiData) {
                    // Use a dictionary comprehension to remove the '_id' field
                    const { _id, ...apiDataCleaned } = apiData;
                    apiDataList.push(apiDataCleaned);
                }
            }

            return {
                statusCode: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ api_data_list: apiDataList }), // Return the API data list
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
