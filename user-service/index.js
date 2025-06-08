// index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
// const initializeServer = require('./server');
const connectDB = require('./src/config/db');
const authRoutes = require('./src/routes/authRoutes');
const userRoutes = require('./src/routes/userRoutes');
const profileRoutes = require('./src/routes/profileRoutes');
const teamThirdPartyApiCallRoutes = require('./src/routes/teamThirdPartyApiCallRoute')
const contestThirdPartyApiCallRoutes = require('./src/routes/contestThirdPartyApiCall')

const app = express();
// const PORT = process.env.PORT || 5003;
connectDB();
// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`[User Service] ${req.method} ${req.originalUrl}`);
  console.log(`[User Service] Body:`, req.body);
  next();
});

// Routes
app.use('/auth', authRoutes);
app.use('/user', userRoutes);
app.use('/profile', profileRoutes);
app.use('/api/users', teamThirdPartyApiCallRoutes)
app.use('/api/user-matches', contestThirdPartyApiCallRoutes)
// Health check
app.get('/', (req, res) => {
  res.send('User Service is running...');
});
app.get('/', (req, res) => {
    res.send('API is running...');
  });

// Init
// (async () => {
//   await initializeServer();

//   app.listen(PORT, () => {
//     console.log(`🚀 User Service running at http://localhost:${PORT}`);
//   });
// })();

module.exports = app;