const express = require('express');
// const bodyParser = require('body-parser');
const connectDB = require('./src/config/db');
require('dotenv').config();
const offerRoutes = require('./src/routes/offerRoutes');
const cors = require('cors')

const app = express();

connectDB();
app.use(express.json());
app.use(cors());

console.log('Setting up wallet routes...');
app.use('/api/offerRoutes', offerRoutes);

app.get('/', (req, res) => {
    res.send('API is running...');
  });  

module.exports = app;
