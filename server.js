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
if (!uri) {
  console.error("❌ MONGODB_URI is not set in environment variables!");
  process.exit(1);
}

// ✅ JWT secret
const JWT_SECRET = process.env.JWT_SECRET || "defaultSecret";

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
    req.user = decoded; // store user info
    next();
  });
}

// Async function to start the server after DB connection
async function startServer() {
  try {
    await client.connect();
    const db = client.db("sellfurnitureDB");
    locationsCollection = db.collection("locations");
    itemsCollection = db.collection("items");
    visitsCollection = db.collection("visits");
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
        console.error("MongoDB fetch error:", error);
        res.status(500).json({ error: "Failed to fetch locations" });
      }
    });

    // GET: Fetch all items
    app.get("/api/items", async (req, res) => {
      try {
        const items = await itemsCollection.find().toArray();
        res.json(items);
      } catch (error) {
        console.error("MongoDB fetch error:", error);
        res.status(500).json({ error: "Failed to fetch items" });
      }
    });
    // POST: Add new item (protected)
    app.post("/api/items", authMiddleware, async (req, res) => {
      try {
        const { 
          title, 
          description, 
          price, 
          locationId, 
          retail, 
          available, 
          url, 
          instructions 
        } = req.body;
    
        if (!title || !price) {
          return res.status(400).json({ error: "Title and price are required" });
        }
    
        const newItem = {
          title,
          description: description || "",
          price: Number(price),
          retail: retail ? Number(retail) : null,   // ✅ fixed
          locationId: locationId || null,
          createdBy: req.user.email,               // track user
          createdAt: new Date(),
          available: available !== undefined ? Boolean(available) : true,
          url: url || "",
          instructions: instructions || ""
        };
    
        const result = await itemsCollection.insertOne(newItem);
        res.status(201).json({ id: result.insertedId, ...newItem });
      } catch (error) {
        console.error("❌ Error adding item:", error);
        res.status(500).json({ error: "Failed to add item" });
      }
    });
    

    // GET: Total number of items
    app.get("/api/totalNumber", async (req, res) => {
      try {
        const totalNumber = await itemsCollection.countDocuments({});
        return res.json({ totalNumber });
      } catch (error) {
        console.error("Error fetching total number of items:", error);
        return res.status(500).send("Error fetching total number of items");
      }
    });

    // GET: Search items
    app.get("/api/search", async (req, res) => {
      try {
        const query = req.query.q;
        if (!query) {
          return res
            .status(400)
            .json({ error: "Query parameter 'q' is required" });
        }

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

    // --- AUTHENTICATION ROUTES ---

    // POST: Register
    app.post("/auth/register", async (req, res) => {
      try {
        const { email, password, name } = req.body;
        if (!email || !password) {
          return res
            .status(400)
            .json({ error: "Email and password are required" });
        }

        const existingUser = await usersCollection.findOne({ email });
        if (existingUser) {
          return res.status(400).json({ error: "User already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = { email, password: hashedPassword, name, role: "user" };

        await usersCollection.insertOne(newUser);
        res.status(201).json({ message: "User registered successfully" });
      } catch (error) {
        console.error("❌ Register error:", error);
        res.status(500).json({ error: "Failed to register" });
      }
    });

    // POST: Login
    app.post("/auth/login", async (req, res) => {
      try {
        const { email, password } = req.body;
        const user = await usersCollection.findOne({ email });
        if (!user) {
          return res.status(400).json({ error: "Invalid email or password" });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
          return res.status(400).json({ error: "Invalid email or password" });
        }

        const token = jwt.sign(
          { email: user.email, role: user.role },
          JWT_SECRET,
          { expiresIn: "1h" }
        );

        res.json({ token });
      } catch (error) {
        console.error("❌ Login error:", error);
        res.status(500).json({ error: "Failed to login" });
      }
    });

    // POST: Logout
    app.post("/auth/logout", (req, res) => {
      // Stateless: just tell frontend to clear token
      res.json({ message: "Logged out successfully" });
    });

    // GET: Current user
    app.get("/auth/me", authMiddleware, async (req, res) => {
      try {
        const user = await usersCollection.findOne(
          { email: req.user.email },
          { projection: { password: 0 } } // hide password
        );
        if (!user) return res.status(404).json({ error: "User not found" });

        res.json(user);
      } catch (error) {
        console.error("❌ Me error:", error);
        res.status(500).json({ error: "Failed to fetch user" });
      }
    });

    // --- LOG VISITS ---
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

    // --- SERVER START ---
    const server = app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

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
