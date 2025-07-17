const mongoose = require('mongoose');
const PredefinedMessage = require('../src/models/predefinedMessageModel'); // Adjust path to your model
require('dotenv').config();// To load your database URL

// --- This is where you define all your chat messages ---
const messagesToSeed = [
    { text: "Good luck! 👍", type: 'GREETING', order: 1 },
    { text: "Hello!", type: 'GREETING', order: 2 },
    { text: "Great pick!", type: 'COMPLIMENT', order: 10 },
    { text: "Nice move!", type: 'COMPLIMENT', order: 11 },
    { text: "My captain is on fire! 🔥", type: 'GAMEPLAY', order: 20 },
    { text: "Let Play Together", type: 'GAMEPLAY', order: 22 },
    { text: "Tough luck.", type: 'GAMEPLAY', order: 21 },
    { text: "You're a tough opponent!", type: 'TAUNT', order: 30 },
    { text: "See you in the next match!", type: 'TAUNT', order: 31 },
];

const seedDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            // Add your connection options if any
        });
        console.log('MongoDB Connected for seeding...');

        // Clear existing messages to avoid duplicates
        await PredefinedMessage.deleteMany({});
        console.log('Cleared existing predefined messages.');

        // Insert the new messages
        await PredefinedMessage.insertMany(messagesToSeed);
        console.log('Successfully seeded new messages!');

    } catch (error) {
        console.error('Error seeding database:', error);
    } finally {
        // Ensure the connection is closed
        await mongoose.connection.close();
        console.log('MongoDB connection closed.');
    }
};

// Run the seeding function
seedDB();