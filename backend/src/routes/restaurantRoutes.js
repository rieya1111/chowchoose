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
  const { roomCode, radius, category } = req.query;
  
  if (!roomCode) {
    return res.status(400).json({ error: "roomCode query parameter is required." });
  }

  // Multiply radius slightly to make the live map search broader across Pune
  const chosenRadius = radius ? parseInt(radius) : 1500;
  const searchRadius = chosenRadius * 2; 
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

    if (room.restaurants.length > 0) {
      return res.json(room.restaurants);
    }

    console.log(`🎯 Initializing deck for room ${roomCode.toUpperCase()} -> Radius: ${searchRadius}m, Type: ${category || 'all'}`);
    let finalSelection = [];

    try {
      const openStreetMapsUrl = `https://overpass-api.de/api/interpreter?data=[out:json];node(around:${searchRadius},18.5204,73.8567)[amenity~"${searchCategory}"];out;`;
      
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

    // FIXED SMART POOL: If live API returns empty, our local database matches the type filter seamlessly!
    if (finalSelection.length === 0) {
      const localPool = [
        { name: "Satguru's Punjabi Rasoi", image: foodImages[2], rating: 4.5, address: `Ravet, Pune`, fallbackCategory: "restaurant" },
        { name: "Chulbul Dhaba", image: foodImages[0], rating: 4.2, address: `Hinjawadi, Pune`, fallbackCategory: "restaurant" },
        { name: "George Restaurant", image: foodImages[1], rating: 4.4, address: `Camp, Pune`, fallbackCategory: "restaurant" },
        
        { name: "McDonald's", image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500", rating: 4.1, address: `Aundh, Pune`, fallbackCategory: "fast_food" },
        { name: "Burger King", image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500", rating: 4.3, address: `F C Road, Pune`, fallbackCategory: "fast_food" },
        
        { name: "Irani Cafe", image: foodImages[3], rating: 4.6, address: `Baner, Pune`, fallbackCategory: "cafe" },
        { name: "The Blue Cup Coffee", image: foodImages[3], rating: 4.3, address: `Kothrud, Pune`, fallbackCategory: "cafe" },
        { name: "Cafe Goodluck", image: foodImages[0], rating: 4.5, address: `Deccan Gymkhana, Pune`, fallbackCategory: "cafe" }
      ];

      let filteredPool = localPool;
      if (category && category !== 'all') {
        filteredPool = localPool.filter(item => item.fallbackCategory === category);
      }

      finalSelection = filteredPool.slice(0, 4).map(item => ({
        name: item.name,
        image: item.image,
        rating: item.rating,
        address: item.address,
        roomId: room.id
      }));
    }

    if (finalSelection.length === 0) {
      finalSelection = [{ name: "ChowChoose Default Diner", image: foodImages[0], rating: 4.2, address: "Pune Main Street", roomId: room.id }];
    }

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