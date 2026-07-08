require('dotenv').config(); // MUST BE LINE 1

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');

const roomRoutes = require('./routes/roomRoutes');
const userRoutes = require('./routes/userRoutes');
const restaurantRoutes = require('./routes/restaurantRoutes');
const swipeRoutes = require('./routes/swipeRoutes');

const app = express();
const server = http.createServer(app);

// Initialize Socket.io with CORS allowed for frontend development
const io = new Server(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());

// Routes
app.use('/api/rooms', roomRoutes);
app.use('/api/users', userRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/swipes', swipeRoutes);

// Basic sanity check route
app.get('/api/health', (req, res) => {
  res.json({ status: "Backend is running smoothly!" });
});

// =========================================================
// REAL-TIME WEBSOCKET EMITTERS & LISTENERS
// =========================================================
io.on('connection', (socket) => {
  console.log(`User connected to websocket channel: ${socket.id}`);

  // 1. Triggered when a user loads up the lobby screen
  socket.on('join_room', async (roomCode) => {
    const formattedCode = roomCode.toUpperCase();
    socket.join(formattedCode);
    console.log(`Socket ${socket.id} joined room channel: ${formattedCode}`);
    
    try {
      // Look up all active registered database users tied to this room session
      const roomUsers = await prisma.user.findMany({
        where: { room: { code: formattedCode } },
        select: { id: true, name: true }
      });
      
      // Broadcast the updated users list to everyone else currently in this room channel
      io.to(formattedCode).emit('update_users', roomUsers);
    } catch (err) {
      console.error("Socket error processing live room update:", err);
    }
  });

  // 2. Triggered when a user completes a card swipe action
  socket.on('submit_swipe', (data) => {
    if (data && data.roomCode) {
      // Relay the swipe status broadcast to the rest of the crew in real time
      socket.to(data.roomCode.toUpperCase()).emit('receive_swipe', data);
    }
  });

  // 3. Triggered when a user finishes swiping their entire deck
  socket.on('user_finished', (data) => {
    if (data && data.roomCode) {
      // Broadcast to everyone else in the room that this user is done!
      socket.to(data.roomCode.toUpperCase()).emit('receive_finished_user', {
        userId: data.userId,
        userName: data.userName
      });
    }
  });

  // 4. Triggered when a player types and sends a message in the lobby chat
  socket.on('send_message', (data) => {
    if (data && data.roomCode) {
      // Broadcast the message payload to everyone else sitting in this room channel
      socket.to(data.roomCode.toUpperCase()).emit('receive_message', {
        user: data.user,
        text: data.text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    }
  });

  socket.on('disconnect', () => {
    console.log(`User left the socket line: ${socket.id}`);
  });
});

// Start listening
server.listen(PORT, () => {
  console.log(`Server is blasting off on port ${PORT} 🚀`);
});