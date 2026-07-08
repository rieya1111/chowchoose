const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// POST /api/swipes - Record or update a user's swipe selection
router.post('/', async (req, res) => {
  const { userId, restaurantId, liked } = req.body;

  if (!userId || restaurantId === undefined) {
    return res.status(400).json({ error: "userId, restaurantId, and liked value are required." });
  }

  try {
    const targetRestaurantId = restaurantId.toString();
    
    // Extract the boolean value sent from frontend (defaults to false if missing)
    const voteValue = liked === true || liked === 'true';

    // FIXED: Switched field mappings from 'liked' to 'isLiked' to match your Prisma Schema
    const savedSwipe = await prisma.swipe.upsert({
      where: {
        userId_restaurantId: {
          userId: userId,
          restaurantId: targetRestaurantId
        }
      },
      update: {
        isLiked: voteValue
      },
      create: {
        userId: userId,
        restaurantId: targetRestaurantId,
        isLiked: voteValue
      }
    });

    // Count how many total likes this specific restaurant has received using the correct schema field
    const totalLikesCount = await prisma.swipe.count({
      where: {
        restaurantId: targetRestaurantId,
        isLiked: true
      }
    });

    res.status(200).json({ savedSwipe, totalLikesCount });
  } catch (error) {
    console.error("Error recording swipe:", error);
    res.status(500).json({ error: "Failed to process swipe entry." });
  }
});

module.exports = router;