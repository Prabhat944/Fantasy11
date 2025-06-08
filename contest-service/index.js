// index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const connectDB = require('./src/config/db');
const contestRoutes = require('./src/routes/contestRoutes');
// const contestAdminRoutes = require('./src/routes/contestAdminRoutes');
// const { initializeScheduledJobs } = require('./src/jobs/scheduleJobs');
// const initializeServer = require('./server');

const app = express();
// const PORT = process.env.PORT || 5004;
connectDB();
// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Routes
app.use('/api/v1/contest', contestRoutes);
// app.use('/admin', contestAdminRoutes);

// Healthcheck
app.get('/health', (req, res) => res.send('Contest Service is running!'));
app.get('/', (req, res) => {
    res.send('API is running...');
  });
// Initialize everything
// (async () => {
//   await initializeServer(); // DB Connection

//   initializeScheduledJobs(); // Cron Jobs

//   app.listen(PORT, () => {
//     console.log(`🚀 Contest Service running at http://localhost:${PORT}`);
//   });
// })();

module.exports = app;