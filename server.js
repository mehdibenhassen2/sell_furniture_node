const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ MongoDB URI from environment variables
const uri = process.env.MONGODB_URI;
// const uri = process.env.MONGO_URI || "mongodb+srv://alfredbouha_db:Manela1982@sellfurnituredb.faz8usm.mongodb.net/?retryWrites=true&w=majority&appName=sellfurnitureDB";

if (!uri) {
  console.error("❌ MONGODB_URI is not set in environment variables!");
  process.exit(1);
}

// Middleware
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

// Async function to start the server after DB connection
async function startServer() {
  try {
    await client.connect();
    const db = client.db("sellfurnitureDB");
    locationsCollection = db.collection("locations");
    itemsCollection = db.collection("items");
    visitsCollection = db.collection("visits"); // ✅ new collection for page visits
    usersCollection = db.collection("users");
    console.log("✅ Connected to MongoDB");

    // --- ROUTES ---

    // POST: Add new location
    app.post("/api/locations", async (req, res) => {
      try {
        const { name } = req.body;
        if (!name)
          return res.status(400).json({ error: "Location name is required" });

        const newLocation = { name };
        const result = await locationsCollection.insertOne(newLocation);
        res.status(201).json({ id: result.insertedId, ...newLocation });
      } catch (error) {
        console.error("❌ Error inserting location:", error);
        res.status(500).json({ error: "Failed to add location" });
      }
    });

    // GET: Fetch all locations
    app.get("/api/locations", async (req, res) => {
      try {
        const locations = await locationsCollection.find().toArray();
        res.json(locations);
      } catch (error) {
        console.error("MongoDB fetch error:", error); // full error
        res.status(500).json({ error: "Failed to fetch locations" });
      }
    });
    // GET: Fetch all items
    app.get("/api/items", async (req, res) => {
      try {
        const items = await itemsCollection.find().toArray();
        res.json(items);
      } catch (error) {
        console.error("MongoDB fetch error:", error); // full error
        res.status(500).json({ error: "Failed to fetch locations" });
      }
    });
    //get total number of items
    app.get("/api/totalNumber", async (req, res) => {
      try {
        const totalNumber = await itemsCollection.countDocuments({});
        return res.json({ totalNumber });
      } catch (error) {
        console.error("Error fetching total number of items:", error);
        return res.status(500).send("Error fetching total number of items");
      }
    });
    // ✅ search request:

    // GET: Fetch filtered items by search term
    app.get("/api/search", async (req, res) => {
      try {
        const query = req.query.q; // e.g. /api/search?q=chair
        if (!query) {
          return res
            .status(400)
            .json({ error: "Query parameter 'q' is required" });
        }

        // Case-insensitive regex search on name/title/description
        const items = await itemsCollection
          .find({
            $or: [
              { name: { $regex: query, $options: "i" } },
              { title: { $regex: query, $options: "i" } },
              { description: { $regex: query, $options: "i" } },
            ],
          })
          .toArray();

        res.json(items);
      } catch (error) {
        console.error("❌ MongoDB search error:", error);
        res.status(500).json({ error: "Failed to search items" });
      }
    });
// authentication
// POST: Login
app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await usersCollection.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    // Vérifier le mot de passe
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    // Générer un token JWT
    const token = jwt.sign(
      { email: user.email, role: user.role },
      "secretKey", // ⚠️ à mettre dans process.env.JWT_SECRET en production
      { expiresIn: "1h" }
    );

    res.json({ token });
  } catch (error) {
    console.error("❌ Login error:", error);
    res.status(500).json({ error: "Failed to login" });
  }
});

    // ✅ POST: Log a page visit
    app.post("/api/visit", async (req, res) => {
      try {
        const visit = {
          timestamp: new Date(),
          ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
          userAgent: req.headers["user-agent"],
        };
        const result = await visitsCollection.insertOne(visit);
        res.status(201).json({ id: result.insertedId, ...visit });
      } catch (error) {
        console.error("❌ Error logging visit:", error);
        res.status(500).json({ error: "Failed to log visit" });
      }
    });
    // Start Express server
    const server = app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

    // Graceful shutdown (for Render or other PaaS)
    process.on("SIGTERM", () => {
      console.log("⚡ SIGTERM received, closing server...");
      server.close(async () => {
        await client.close();
        console.log("✅ MongoDB connection closed. Exiting.");
        process.exit(0);
      });
    });

    process.on("unhandledRejection", (reason, promise) => {
      console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
      process.exit(1);
    });
  } catch (error) {
    console.error("❌ Failed to connect to MongoDB:", error);
    process.exit(1);
  }
}

// Start the server
startServer();
