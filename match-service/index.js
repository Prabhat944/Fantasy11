// match-service/index.js
// require('./server'); // ✅ This connects to MongoDB first
require('dotenv').config(); 
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const connectDB = require('./src/config/db');

const matchRoutes = require('./src/routes/matchRoutes');
const contestThirdPartyApiCallRoutes = require('./src/routes/contestThirdPartyApiCall')
// const { initializeScheduledJobs } = require('./src/jobs/scheduleJobs');

const app = express();
connectDB();

// const PORT = process.env.PORT || 5004;

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Routes
app.use('/api/v1/cricket', matchRoutes); // Forwarded by Gateway as /api/v1/matches
app.use('/api/matches', contestThirdPartyApiCallRoutes);
// Health route
app.get('/', (req, res) => res.send('Match Service is running...'));
app.get('/', (req, res) => {
    res.send('API is running...');
  });

// Start CRON jobs
// initializeScheduledJobs();

// // Server Start
// app.listen(PORT, () => {
//   console.log(`🚀 Match Service running at http://localhost:${PORT}`);
// });

module.exports = app;