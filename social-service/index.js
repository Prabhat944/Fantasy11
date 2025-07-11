// index.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const connectDB = require('./src/config/db');
const ChatMessage = require('./src/models/chatMessageModel'); // Import the ChatMessage model

// Import Routes
const chatRoutes = require('./src/routes/chatRoutes');
const friendshipRoutes = require('./src/routes/friendshipRoutes');
const leagueRoutes = require('./src/routes/leagueRoutes');

const app = express();
connectDB();

// --- Middleware ---
app.use(express.json());
app.use(cors());

// --- Make io instance available to all routes ---
app.use((req, res, next) => {
    req.io = io;
    next();
  });
// --- API Routes ---
app.use('/api/chat', chatRoutes); 
app.use('/api/friends', friendshipRoutes);
app.use('/api/leagues', leagueRoutes);

app.get('/', (req, res) => {
    res.send('Social Service API is running...');
});

// --- Server & Socket.IO Setup ---
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Be more specific in production!
    methods: ["GET", "POST"]
  }
});

// --- Socket.IO Connection Logic ---
io.on('connection', (socket) => {
  console.log('A user connected with socket ID:', socket.id);

  // A more generic event for joining any room (league or contest)
  socket.on('joinRoom', (roomName) => {
    socket.join(roomName);
    console.log(`User ${socket.id} joined room: ${roomName}`);
  });

  // 👇 --- UPDATED REAL-TIME MESSAGE HANDLER --- 👇
  socket.on('sendMessage', async (data, callback) => {
    try {
      // Data now includes the room type to distinguish between league/contest
      const { roomType, roomId, content, senderId } = data;

      if (!roomType || !roomId || !content || !senderId) {
        return callback({ status: 'error', message: 'Missing required data' });
      }

      let newMessageData = {
        content,
        sender: senderId,
      };

      // Assign to the correct field (leagueId or contestId) based on room type
      if (roomType === 'league') {
        newMessageData.leagueId = roomId;
      } else if (roomType === 'contest') {
        newMessageData.contestId = roomId;
      } else {
        return callback({ status: 'error', message: 'Invalid room type specified.' });
      }

      // 1. Save the new message to the database
      let newMessage = new ChatMessage(newMessageData);
      await newMessage.save();

      // 2. Populate the sender's info for the broadcast payload
      newMessage = await newMessage.populate('sender', 'name profileImage');

      // 3. Broadcast the new message to all clients in the specific room
      io.to(roomId).emit('newMessage', newMessage);

      // 4. Acknowledge to the sender that the message was sent
      if (callback) callback({ status: 'ok' });

    } catch (error) {
      console.error("Error in sendMessage handler:", error);
      if (callback) callback({ status: 'error', message: 'Failed to send message' });
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Export both app and the server with Socket.IO attached
module.exports = { app, server };