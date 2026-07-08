const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Helper function to generate a unique 4-character room code
function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// POST /api/rooms - Create a new session room
router.post('/', async (req, res) => {
  try {
    const uniqueCode = generateRoomCode();
    
    // Create the room record inside PostgreSQL using Prisma
    const newRoom = await prisma.room.create({
      data: {
        code: uniqueCode
      }
    });

    res.status(201).json(newRoom);
  } catch (error) {
    console.error("Error creating room:", error);
    res.status(500).json({ error: "Failed to generate a session room." });
  }
});

module.exports = router;