const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// POST /api/users - Create or find a user inside a room session
router.post('/', async (req, res) => {
  const { name, roomCode } = req.body;

  if (!name || !roomCode) {
    return res.status(400).json({ error: "Name and roomCode are required." });
  }

  try {
    // 1. Double check that the room exists first
    const room = await prisma.room.findUnique({
      where: { code: roomCode.toUpperCase() }
    });

    if (!room) {
      return res.status(404).json({ error: "Room session not found." });
    }

    // 2. Create the user and link them directly to that room ID
    const newUser = await prisma.user.create({
      data: {
        name: name,
        roomId: room.id
      }
    });

    // CRITICAL: We must send back the full object so App.jsx can read data.id
    res.status(201).json(newUser);
  } catch (error) {
    console.error("Error creating user entry:", error);
    res.status(500).json({ error: "Failed to establish user session." });
  }
});

module.exports = router;