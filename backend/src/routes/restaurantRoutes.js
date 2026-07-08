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

// 2. GET /api/restaurants - Safe automated fetch with customized dynamic filtering
router.get('/', async (req, res) => {
  // Destructure custom configuration filters sent from the client lobby
  const { roomCode, radius, category } = req.query;
  
  if (!roomCode) {
    return res.status(400).json({ error: "roomCode query parameter is required." });
  }

  // Parse customization options with clean fallbacks if missing
  const searchRadius = radius ? parseInt(radius) : 1500;
  const searchCategory = category && category !== 'all' ? category : 'restaurant|cafe|fast_food';

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

    // If this room session already generated its deck card models, return them immediately
    if (room.restaurants.length > 0) {
      return res.json(room.restaurants);
    }

    console.log(`🎯 Initializing deck for room ${roomCode.toUpperCase()} -> Radius: ${searchRadius}m, Type: ${category || 'all'}`);
    let finalSelection = [];

    try {
      // DYNAMIC FIX: Inject our host customized variables directly into the live Overpass query string
      const openStreetMapsUrl = `https://overpass-api.de/api/interpreter?data=[out:json];node(around:${searchRadius},18.5204,73.8567)[amenity~"${searchCategory}"];out;`;
      
      // FIXED: Adding custom User-Agent headers to bypass the public Overpass 406 barrier
      const response = await fetch(openStreetMapsUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'ChowChooseApp/1.0 (riya.sankpal@dypic.in)',
          'Accept': 'application/json'
        }
      });
      
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
      console.warn("External API call bypassed. Using safe local database fallbacks:", apiError.message);
    }

    // LOCAL POOL FIX: Format elements to match exact structural properties expected by Prisma
    if (finalSelection.length === 0) {
      const localPool = [
        { name: "Satguru's Punjabi Rasoi", image: foodImages[2], rating: 4.5, address: `Ravet, Pune (${searchRadius}m away)`, fallbackCategory: "restaurant" },
        { name: "Chulbul Dhaba", image: foodImages[0], rating: 4.2, address: `Hinjawadi, Pune (${searchRadius}m away)`, fallbackCategory: "restaurant" },
        { name: "McDonald's", image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500", rating: 4.1, address: `Aundh, Pune (${searchRadius}m away)`, fallbackCategory: "fast_food" },
        { name: "Pizza Mania Dine", image: foodImages[1], rating: 4.4, address: `Wakad, Pune (${searchRadius}m away)`, fallbackCategory: "restaurant" },
        { name: "Irani Cafe", image: foodImages[3], rating: 4.6, address: `Baner, Pune (${searchRadius}m away)`, fallbackCategory: "cafe" },
        { name: "The Blue Cup Coffee", image: foodImages[3], rating: 4.3, address: `Kothrud, Pune (${searchRadius}m away)`, fallbackCategory: "cafe" }
      ];

      // Filter local fallback selection to respect host choice if specific category was requested
      let filteredPool = localPool;
      if (category && category !== 'all') {
        filteredPool = localPool.filter(item => item.fallbackCategory === category);
      }

      // Map pool array cleanly (Injects missing roomId, strips temporary helper tags)
      finalSelection = filteredPool.slice(0, 4).map(item => ({
        name: item.name,
        image: item.image,
        rating: item.rating,
        address: item.address,
        roomId: room.id
      }));
    }

    // Safety fallback save guard in case pool length is restricted
    if (finalSelection.length === 0) {
      finalSelection = [{ name: "ChowChoose Default Diner", image: foodImages[0], rating: 4.2, address: "Pune Main Street", roomId: room.id }];
    }

    // Build models inside PostgreSQL safely without mapping constraint errors
    await prisma.restaurant.createMany({ data: finalSelection });

    const updatedRoom = await prisma.room.findUnique({
      where: { id: room.id },
      include: { restaurants: { include: { swipes: true } } }
    });
    return res.json(updatedRoom.restaurants);

  } catch (error) {
    console.error("Critical error inside restaurant routing:", error);
    res.status(500).json({ error: "Failed to assemble cards deck." });
  }
});

module.exports = router;