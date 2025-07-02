// server.js
const express = require('express');
// const bodyParser = require('body-parser');
const connectDB = require('./src/config/db');
require('dotenv').config();
const walletRoutes = require('./src/routes/walletRoutes'); // Import wallet routes
const cors = require('cors')

const app = express();

connectDB();
app.use(express.json());
app.use(cors());

// Mount wallet routes under the '/api/wallet' base path
// All routes defined in walletRoutes.js will now be prefixed with /api/wallet
// e.g., GET /api/wallet/:userId, POST /api/wallet/deposit
console.log('Setting up wallet routes...');
app.use('/api/wallet', walletRoutes);

// Basic error handling middleware (optional but good practice)
app.get('/', (req, res) => {
    res.send('API is running...');
  });  

module.exports = app;
