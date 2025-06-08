// api-gateway/server.js

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 5002;

const USER_SERVICE_BASE_URL = process.env.USER_SERVICE_URL; // e.g., http://localhost:5003

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Helper function to forward requests with axios
// Removed `targetPath` from parameters as it's now derived directly from originalUrl
async function forwardRequest(req, res, targetBaseUrl) { // NO targetPath here
  try {
    // req.originalUrl will be something like '/api/v1/auth/signup' or '/api/v1/user/update'
    // We want to transform it to '/auth/signup' or '/user/update' for the microservice
    const microservicePath = req.originalUrl.replace('/api/v1', '');

    const url = `${targetBaseUrl}${microservicePath}`; // Correctly forms the target URL
    console.log(`[API Gateway] Forwarding ${req.method} ${req.originalUrl} to ${url}`);

    // Build config for axios
    const config = {
      method: req.method,
      url, // Use the correctly constructed URL
      headers: { ...req.headers },
      data: req.body, // Will be undefined for GET requests, which is fine
      timeout: 10000, // <--- Consider increasing this (e.g., 30 seconds) for more robust handling
      validateStatus: () => true, // forward status codes as is
    };

    // Remove host header - axios manages it automatically to the target service's host
    delete config.headers.host;
    // Also remove connection header as Axios manages connections
    delete config.headers.connection;
    // Remove content-length for GET/DELETE requests as they typically don't have bodies
    if (req.method === 'GET' || req.method === 'DELETE') {
      delete config.headers['content-length'];
    }

    const response = await axios(config);

    // Forward headers and status code
    for (const header in response.headers) {
      if (response.headers.hasOwnProperty(header)) {
        res.setHeader(header, response.headers[header]);
      }
    }
    res.status(response.status).json(response.data);

  } catch (error) {
    console.error(`[API Gateway] Error forwarding request:`, error.message);
    if (error.response) {
      // Forward the actual error response from the microservice
      res.status(error.response.status).json(error.response.data);
    } else if (error.request) {
      // The request was made but no response was received (e.g., network error, timeout)
      res.status(504).json({ message: 'Gateway Timeout: No response from upstream service.', error: error.message });
    } else {
      // Something else happened in setting up the request
      res.status(500).json({ message: 'Internal Server Error in API Gateway', error: error.message });
    }
  }
}

// Routes for auth service
app.all('/api/v1/auth/*', (req, res) => {
  forwardRequest(req, res, USER_SERVICE_BASE_URL); // Pass only targetBaseUrl
});

// Routes for user service
app.all('/api/v1/user/*', (req, res) => {
  forwardRequest(req, res, USER_SERVICE_BASE_URL); // Pass only targetBaseUrl
});

// Add route for profile service if it's separate, or if /profile is also handled by user service
app.all('/api/v1/profile/*', (req, res) => {
  forwardRequest(req, res, USER_SERVICE_BASE_URL);
});


app.get('/', (req, res) => {
  res.send('API Gateway running...');
});

// Catch-all for undefined routes in the API Gateway
app.use((req, res) => {
  res.status(404).json({ message: 'API Gateway Route not found.' });
});

app.listen(PORT, () => {
  console.log(`API Gateway running on http://localhost:${PORT}`);
});