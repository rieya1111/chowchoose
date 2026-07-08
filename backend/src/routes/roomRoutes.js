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

// NEW: Purge expired room sessions older than 24 hours
router.delete('/clean', async (req, res) => {
  try {
    // Calculate the timestamp for exactly 24 hours ago
    const expirationTime = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Delete all rooms created before that timestamp
    // Because of your Prisma schema relations, this will cascade and clear old data safely!
    const purgeBatch = await prisma.room.deleteMany({
      where: {
        createdAt: {
          lt: expirationTime
        }
      }
    });

    console.log(`🧹 Database Cleanup executed! Purged ${purgeBatch.count} expired sessions.`);
    res.json({ 
      success: true, 
      message: `Successfully flushed ${purgeBatch.count} old room sessions from storage.` 
    });
  } catch (error) {
    console.error("Database purge routine failed:", error);
    res.status(500).json({ error: "Failed to clear expired records." });
  }
});

module.exports = router;