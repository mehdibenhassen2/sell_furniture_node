const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');

const uri = process.env.MONGO_URI; // ✅ Use environment variable

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let locationsCollection;

async function startServer() {
  try {
    await client.connect();
    const db = client.db("sellfurnitureDB"); // ✅ make sure this DB exists in Atlas
    locationsCollection = db.collection("locations");
    console.log("✅ Connected to MongoDB");

    // POST
    app.post('/api/locations', async (req, res) => {
      try {
        const { name } = req.body;
        if (!name) {
          return res.status(400).json({ error: 'Location name is required' });
        }
        const newLocation = { name };
        const result = await locationsCollection.insertOne(newLocation);
        res.status(201).json({ id: result.insertedId, ...newLocation });
      } catch (error) {
        console.error("Error inserting location:", error);
        res.status(500).json({ error: "Failed to add location" });
      }
    });

    // GET
    app.get('/api/locations', async (req, res) => {
      try {
        const locations = await locationsCollection.find().toArray();
        res.json(locations);
      } catch (error) {
        console.error("Error fetching locations:", error);
        res.status(500).json({ error: "Failed to fetch locations" });
      }
    });

    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1); // ✅ exit so Render shows error
  }
}

startServer();
