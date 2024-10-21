const { MongoClient } = require('mongodb');

// Function to seed the random number generator
const seedRandom = (seed) => {
    let m = 0x80000000, // 2**31
        a = 1103515245, // Random number generator parameters
        c = 12345;
    let state = seed % m;
    return () => {
        state = (a * state + c) % m;
        return state / m;
    };
};

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
                'Access-Control-Allow-Methods': 'GET,HEAD,OPTIONS,POST',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            },
        };
    }

    // Split the path to determine the route
    const pathParts = event.path.split('/');
    const lastPathPart = pathParts[pathParts.length - 1];

    // POST /tags/tags-data route
    if (lastPathPart === 'tags-data' && event.httpMethod === 'POST') {
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
            const apiImgCollection = db.collection('api-img');

            // Create a set to hold unique serial numbers
            const serialNumberSets = new Set(); 

            // Iterate through each tag in tagsList
            for (const tag of tagsList) {
                const results = await imgSummaryCollection.find({ 'tag_data.tag_name': tag }).toArray();
                
                results.forEach(doc => {
                    doc.tag_data.forEach(tagData => {
                        if (tagData.tag_name === tag) {
                            tagData.serial_number_list.forEach(serialNumber => {
                                serialNumberSets.add(serialNumber);
                            });
                        }
                    });
                });
            }

            // Convert the Set to an array
            const serialNumberArray = Array.from(serialNumberSets);

            // Get the current timestamp in seconds as seed
            const currentTimestamp = Math.floor(Date.now() / 1000);
            const random = seedRandom(currentTimestamp);

            // Shuffle the array with seeded randomization
            const shuffleArray = (array) => {
                for (let i = array.length - 1; i > 0; i--) {
                    const j = Math.floor(random() * (i + 1));
                    [array[i], array[j]] = [array[j], array[i]];
                }
                return array;
            };

            // Shuffle the serial numbers
            const shuffledSerialNumbers = shuffleArray(serialNumberArray);

            // Limit to the first 60
            const serialNumberList = shuffledSerialNumbers.slice(0, 60);
            const apiDataList = [];

            // Fetch data for each serial number from the api-img collection
            for (const serialNo of serialNumberList) {
                const apiData = await apiImgCollection.findOne({ serial_no: serialNo });
                if (apiData) {
                    const apiDataCleaned = { ...apiData };
                    delete apiDataCleaned._id; // Remove MongoDB id
                    apiDataList.push(apiDataCleaned);
                }
            }

            return {
                statusCode: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ api_data_list: apiDataList }),
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
