const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');

// ⚠️ Never hardcode credentials in code. Use environment variables in Render!
const uri = "mongodb+srv://alfredbouha_db:Manela1982@sellfurnituredb.faz8usm.mongodb.net/?retryWrites=true&w=majority&appName=sellfurnitureDB";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// --------------------------
// ✅ MongoDB Connection
// --------------------------
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let db, locationsCollection;

async function connectDB() {
  try {
    await client.connect();
    db = client.db("sellfurnitureDB");   // 👈 choose your DB name
    locationsCollection = db.collection("locations"); // 👈 use/create collection
    console.log("✅ Connected to MongoDB");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
  }
}
connectDB();

// --------------------------
// ✅ Routes
// --------------------------

// POST: Add a new location (to MongoDB)
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

// GET: Retrieve all locations (from MongoDB)
app.get('/api/locations', async (req, res) => {
  try {
    const locations = await locationsCollection.find().toArray();
    res.json(locations);
  } catch (error) {
    console.error("Error fetching locations:", error);
    res.status(500).json({ error: "Failed to fetch locations" });
  }
});


// --------------------------
// ✅ Start Server
// --------------------------
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
