const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ MongoDB URI from environment variables
const uri = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET || "defaultSecret";

if (!uri) {
  console.error("❌ MONGODB_URI is not set!");
  process.exit(1);
}

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(bodyParser.json());

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let locationsCollection, itemsCollection, visitsCollection, usersCollection;

// 🔐 Auth middleware
function authMiddleware(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) return res.status(401).json({ error: "No token provided" });

  const token = authHeader.split(" ")[1];
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    req.user = decoded;
    next();
  });
}

// Start server after DB connection
async function startServer() {
  try {
    await client.connect();
    const db = client.db("sellfurnitureDB");
    locationsCollection = db.collection("locations");
    itemsCollection = db.collection("items");
    visitsCollection = db.collection("visits");
    usersCollection = db.collection("users");
    console.log("✅ Connected to MongoDB");

    // ---------------------------
    // ITEMS
    // ---------------------------
    // Public: GET all items
    app.get("/api/items", async (req, res) => {
      try {
        const items = await itemsCollection.find().toArray();
        res.json(items);
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch items" });
      }
    });

    // Protected: POST new item
    app.post("/api/items", authMiddleware, async (req, res) => {
      try {
        const newItem = {
          ...req.body,
          userId: req.user.email,
          createdAt: new Date(),
        };
        const result = await itemsCollection.insertOne(newItem);
        res.status(201).json({ id: result.insertedId, ...newItem });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to add item" });
      }
    });

    // ---------------------------
    // LOCATIONS
    // ---------------------------
    // Public: GET all locations
    app.get("/api/locations", async (req, res) => {
      try {
        const locations = await locationsCollection.find().toArray();
        res.json(locations);
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch locations" });
      }
    });

    // Protected: POST new location
    app.post("/api/locations", authMiddleware, async (req, res) => {
      try {
        const newLocation = {
          ...req.body,
          userId: req.user.email,
          createdAt: new Date(),
        };
        const result = await locationsCollection.insertOne(newLocation);
        res.status(201).json({ id: result.insertedId, ...newLocation });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to add location" });
      }
    });

    // ---------------------------
    // AUTHENTICATION
    // ---------------------------
    app.post("/auth/register", async (req, res) => {
      try {
        const { email, password, name } = req.body;
        if (!email || !password)
          return res.status(400).json({ error: "Email and password required" });

        const exists = await usersCollection.findOne({ email });
        if (exists)
          return res.status(400).json({ error: "User already exists" });

        const hashed = await bcrypt.hash(password, 10);
        const newUser = {
          email,
          password: hashed,
          name,
          role: "user",
          createdAt: new Date(),
        };
        await usersCollection.insertOne(newUser);
        res.status(201).json({ message: "User registered successfully" });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to register" });
      }
    });

    app.post("/auth/login", async (req, res) => {
      try {
        const { email, password } = req.body;
        const user = await usersCollection.findOne({ email });
        if (!user)
          return res.status(400).json({ error: "Invalid email or password" });

        const valid = await bcrypt.compare(password, user.password);
        if (!valid)
          return res.status(400).json({ error: "Invalid email or password" });

        const token = jwt.sign(
          { email: user.email, role: user.role },
          JWT_SECRET,
          { expiresIn: "1h" }
        );
        res.json({ token });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to login" });
      }
    });

    app.post("/auth/logout", (req, res) => {
      res.json({ message: "Logged out successfully" });
    });

    app.get("/auth/me", authMiddleware, async (req, res) => {
      try {
        const user = await usersCollection.findOne(
          { email: req.user.email },
          { projection: { password: 0 } }
        );
        if (!user) return res.status(404).json({ error: "User not found" });
        res.json(user);
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch user" });
      }
    });

    // ---------------------------
    // VISITS
    // ---------------------------
    app.post("/api/visit", async (req, res) => {
      try {
        const visit = {
          timestamp: new Date(),
          ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
          userAgent: req.headers["user-agent"],
        };
        const result = await visitsCollection.insertOne(visit);
        res.status(201).json({ id: result.insertedId, ...visit });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to log visit" });
      }
    });

    // ---------------------------
    // START SERVER
    // ---------------------------
    const server = app.listen(PORT, () =>
      console.log(`🚀 Server running on port ${PORT}`)
    );

    process.on("SIGTERM", () => {
      console.log("⚡ SIGTERM received, closing server...");
      server.close(async () => {
        await client.close();
        console.log("✅ MongoDB closed. Exiting.");
        process.exit(0);
      });
    });

    process.on("unhandledRejection", (reason, promise) => {
      console.error("❌ Unhandled Rejection:", reason, promise);
      process.exit(1);
    });
  } catch (err) {
    console.error("❌ Failed to connect to MongoDB:", err);
    process.exit(1);
  }
}

// Start server
startServer();
