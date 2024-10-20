const { MongoClient } = require('mongodb');

exports.handler = async (event, context) => {
    const mongoUrl = process.env.MONGO_URL; 
    const client = new MongoClient(mongoUrl);
    const pathParts = event.path.split('/');
    const pageNumber = parseInt(pathParts[pathParts.length - 1], 10); 
    const limit = 40; 
    const skip = pageNumber ? (pageNumber - 1) * limit : 0; 

    try {
        await client.connect();
        const db = client.db('project-h');
        const collection = db.collection('api-img');

        let documents;

        if (isNaN(pageNumber)) {
            documents = await collection.find({})
                .project({ _id: 0, title: 1 }) // Only fetch the title field
                .toArray();
        } else {
            documents = await collection.find({})
                .project({ _id: 0, title: 1 }) // Only fetch the title field
                .skip(skip)
                .limit(limit)
                .toArray();
        }

        if (documents.length === 0 && !isNaN(pageNumber)) {
            return {
                statusCode: 404,
                headers: {
                    'Access-Control-Allow-Origin': '*', // Allow all origins
                },
                body: JSON.stringify({ error: 'No documents found for this page' }),
            };
        }

        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*', // Allow all origins
                'Content-Type': 'application/json', // Set content type to JSON
            },
            body: JSON.stringify(documents), 
        };
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
