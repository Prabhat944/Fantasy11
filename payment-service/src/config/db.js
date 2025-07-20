// config/db.js
const mongoose = require('mongoose');

const connectDB = async () => {
    const MONGODB_URI = process.env.MONGO_URI;

    if (!MONGODB_URI) {
        console.error('Error: MONGODB_URI is not defined in .env file. Please set it.');
        process.exit(1); // Exit if no MongoDB URI is provided
    }

    try {
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('MongoDB Connected Successfully!');
    } catch (err) {
        console.error('MongoDB connection error:', err.message);
        process.exit(1); // Exit process with failure
    }
};

module.exports = connectDB;
