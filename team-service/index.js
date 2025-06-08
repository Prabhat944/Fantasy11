// index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const connectDB = require('./src/config/db');
// const initializeServer = require('./server');
const teamRoutes = require('./src/routes/teamRoutes');
const thirdPartyRoutes = require('./src/routes/thirdPartyApiCallRoute')

const app = express();
// const PORT = process.env.PORT || 5005;
connectDB();
// Middlewares
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Routes
app.use('/', teamRoutes);
app.use('/api/teams', thirdPartyRoutes)
// Health check
app.get('/health', (req, res) => res.send('Team Service is running!'));
app.get('/', (req, res) => {
    res.send('API is running...');
  });
// Init
// (async () => {
//   await initializeServer();

//   app.listen(PORT, () => {
//     console.log(`🚀 Team Service running at http://localhost:${PORT}`);
//   });
// })();

module.exports = app;