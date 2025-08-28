const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// In-memory storage for locations
let locations = [];

// ✅ POST: Add a new location
app.post('/api/locations2', (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Location name is required' });
  }

  const newLocation = {
    id: locations.length + 1,
    name
  };

  locations.push(newLocation);

  res.status(201).json(newLocation);
});

// ✅ GET: Retrieve all locations
app.get('/api/locations', (req, res) => {
  res.json(locations);
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
