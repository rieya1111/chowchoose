const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// 1. POST /api/restaurants - Add a custom restaurant manually
router.post('/', async (req, res) => {
  const { name, imageUrl, roomCode } = req.body;
  if (!name || !roomCode) {
    return res.status(400).json({ error: "Restaurant name and roomCode are required." });
  }
  try {
    const room = await prisma.room.findUnique({ where: { code: roomCode.toUpperCase() } });
    if (!room) return res.status(404).json({ error: "Room not found." });

    const newRestaurant = await prisma.restaurant.create({
      data: { name, image: imageUrl || "", roomId: room.id }
    });
    res.status(201).json(newRestaurant);
  } catch (error) {
    res.status(500).json({ error: "Failed to add restaurant." });
  }
});

// 2. GET /api/restaurants - Safe automated fetch with robust fallback handling
router.get('/', async (req, res) => {
  const { roomCode } = req.query;
  if (!roomCode) {
    return res.status(400).json({ error: "roomCode query parameter is required." });
  }

  // Define high-res food stock images for fallback use
  const foodImages = [
    "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=500", 
    "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=500", 
    "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=500", 
    "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=500"  
  ];

  try {
    const room = await prisma.room.findUnique({
      where: { code: roomCode.toUpperCase() },
      include: { restaurants: { include: { swipes: true } } }
    });

    if (!room) return res.status(404).json({ error: "Room not found." });

    if (room.restaurants.length === 0) {
      console.log(`Attempting live restaurant data pull for room ${roomCode.toUpperCase()}...`);
      let finalSelection = [];

      try {
        const openStreetMapsUrl = `https://overpass-api.de/api/interpreter?data=[out:json];node(around:1500,18.5204,73.8567)[amenity~"restaurant|cafe|fast_food"];out;`;
        
        const response = await fetch(openStreetMapsUrl);
        
        // FIXED: If API returns an HTML error status, throw immediately to skip to fallback logic
        if (!response.ok) {
          throw new Error(`API returned bad status code: ${response.status}`);
        }

        const data = await response.json();
        const rawElements = data.elements || [];
        
        finalSelection = rawElements
          .filter(el => el.tags && el.tags.name)
          .slice(0, 8)
          .map((el, index) => {
            const type = el.tags.amenity || "food";
            return {
              name: el.tags.name,
              image: foodImages[index % foodImages.length],
              rating: parseFloat((4.0 + Math.random() * 0.9).toFixed(1)),
              address: el.tags["addr:street"] || `${type.toUpperCase()} Zone, Pune`,
              roomId: room.id
            };
          });

      } catch (apiError) {
        // If external API times out or blocks us, populate the fallback array gracefully
        console.warn("External API call bypassed. Using safe local database fallbacks:", apiError.message);
      }

      // If the API failed or returned an empty set, run our clean default seeds
      if (finalSelection.length === 0) {
        finalSelection = [
          { name: "Satguru's Punjabi Rasoi", image: foodImages[2], rating: 4.5, address: "Ravet, Pune", roomId: room.id },
          { name: "Chulbul Dhaba", image: foodImages[0], rating: 4.2, address: "Hinjawadi, Pune", roomId: room.id },
         { name: "McDonald's", image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500", rating: 4.1, address: "Aundh, Pune", roomId: room.id },
          { name: "Pizza Mania Dine", image: foodImages[1], rating: 4.4, address: "Wakad, Pune", roomId: room.id }
        ];
      }

      await prisma.restaurant.createMany({ data: finalSelection });

      const updatedRoom = await prisma.room.findUnique({
        where: { id: room.id },
        include: { restaurants: { include: { swipes: true } } }
      });
      return res.json(updatedRoom.restaurants);
    }

    res.json(room.restaurants);
  } catch (error) {
    console.error("Critical error inside restaurant routing:", error);
    res.status(500).json({ error: "Failed to assemble cards deck." });
  }
});

module.exports = router;