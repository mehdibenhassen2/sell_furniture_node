const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');

const uri = "mongodb+srv://alfredbouha_db:Manela1982@sellfurnituredb.faz8usm.mongodb.net/?retryWrites=true&w=majority&appName=sellfurnitureDB";

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
    const db = client.db("sellfurnitureDB");
    locationsCollection = db.collection("locations");
    console.log("✅ Connected to MongoDB");

    // Define routes only after DB is connected

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

    // Start server AFTER routes are set
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });

  } catch (error) {
    console.error("❌ Failed to start server:", error);
  }
}

startServer();
