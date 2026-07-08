import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Users, LogIn, PlusCircle, Heart, X, Utensils, Award, MapPin, Star, Crown } from 'lucide-react';

const socket = io('http://localhost:5000');

export default function App() {
  const [view, setView] = useState('landing'); 
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [restaurants, setRestaurants] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [matchedRestaurant, setMatchedRestaurant] = useState(null);
  const [results, setResults] = useState([]);
  const [userId, setUserId] = useState('');
  
  const [activeUsers, setActiveUsers] = useState([]);
  const [finishedUsers, setFinishedUsers] = useState([]);

  useEffect(() => {
    socket.on('receive_swipe', (data) => {
      console.log("Real-time swipe alert received:", data);
    });

    socket.on('update_users', (usersList) => {
      setActiveUsers(usersList);
    });

    socket.on('receive_finished_user', (finishedData) => {
      setFinishedUsers((prev) => {
        if (prev.includes(finishedData.userName)) return prev;
        return [...prev, finishedData.userName];
      });
    });

    return () => {
      socket.off('receive_swipe');
      socket.off('update_users');
      socket.off('receive_finished_user');
    };
  }, []);

  const createRoom = async () => {
    if (!name.trim()) return alert('Please enter your name first!');
    try {
      const response = await fetch('http://localhost:5000/api/rooms', { method: 'POST' });
      const data = await response.json();
      if (data.code) {
        setRoomCode(data.code);
        joinRoomSession(name, data.code);
      }
    } catch (error) {
      alert("Failed to reach backend server.");
    }
  };

  const handleJoinSubmit = () => {
    if (!name.trim()) return alert('Please enter your name!');
    if (!roomCode.trim()) return alert('Please enter a room code!');
    joinRoomSession(name, roomCode);
  };

  const joinRoomSession = async (userName, code) => {
    try {
      const response = await fetch('http://localhost:5000/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: userName, roomCode: code })
      });
      const data = await response.json();
      if (data.error) {
        alert(data.error);
      } else {
        setUserId(data.id);
        setView('lobby');
        socket.emit('join_room', code);
        fetchRestaurants(code);
      }
    } catch (error) {
      alert("Error joining the room session.");
    }
  };

  const fetchRestaurants = async (code) => {
    try {
      const response = await fetch(`http://localhost:5000/api/restaurants?roomCode=${code}`);
      const data = await response.json();
      setRestaurants(data);
    } catch (error) {
      console.error("Error grabbing dining choices:", error);
    }
  };

  const fetchFinalResults = async () => {
    try {
      const response = await fetch(`http://localhost:5000/api/restaurants?roomCode=${roomCode}`);
      const data = await response.json();
      setResults(data);
      setView('results');
    } catch (error) {
      console.error("Failed to compile final summaries:", error);
    }
  };

  const handleSwipeAction = async (isLiked) => {
    const activeRest = restaurants[currentIndex];
    
    try {
      const response = await fetch('http://localhost:5000/api/swipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId,
          restaurantId: activeRest.id,
          liked: isLiked
        })
      });
      const data = await response.json();
      
      if (isLiked && data.totalLikesCount > 1) {
        setMatchedRestaurant(activeRest.name);
        setView('match');
        return;
      }
    } catch (error) {
      console.error("Failed to commit vote:", error);
    }

    socket.emit('submit_swipe', {
      roomCode,
      restaurantName: activeRest.name,
      isLiked
    });

    if (currentIndex < restaurants.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      socket.emit('user_finished', {
        roomCode,
        userId,
        userName: name
      });
      fetchFinalResults();
    }
  };

  const handleDragEnd = (event, info) => {
    const swipeThreshold = 100;
    if (info.offset.x > swipeThreshold) {
      handleSwipeAction(true);
    } else if (info.offset.x < -swipeThreshold) {
      handleSwipeAction(false);
    }
  };

  // NEW STEP 5 LOGIC: Calculate the absolute highest vote tally to find the runner-up champion option
  const getHighestLikeCount = () => {
    if (results.length === 0) return 0;
    return Math.max(...results.map(r => r.swipes ? r.swipes.filter(s => s.isLiked).length : 0));
  };

  const highestLikeCount = getHighestLikeCount();

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', background: '#f8fafc', minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', color: '#334155', overflow: 'hidden' }}>
      <div style={{ background: '#ffffff', padding: '30px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', width: '100%', maxWidth: '400px', textAlign: 'center', position: 'relative' }}>
        
        <h1 style={{ color: '#ef4444', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', margin: '0 0 8px 0' }}>
          <Sparkles /> ChowChoose
        </h1>

        {view === 'landing' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '20px' }}>
            <input type="text" placeholder="Your Name" value={name} onChange={(e) => setName(e.target.value)} style={{ padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '16px' }} />
            <button onClick={createRoom} style={{ padding: '12px', background: '#ef4444', color: '#fff', border: '0', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><PlusCircle size={20} /> Create New Room</button>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input type="text" placeholder="4-Letter Code" value={roomCode} onChange={(e) => setRoomCode(e.target.value.toUpperCase())} style={{ padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '16px', width: '60%' }} />
              <button onClick={handleJoinSubmit} style={{ padding: '10px', background: '#3b82f6', color: '#fff', border: '0', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', flexGrow: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}><LogIn size={18} /> Join</button>
            </div>
          </div>
        )}

        {view === 'lobby' && (
          <div style={{ marginTop: '20px' }}>
            <div style={{ background: '#f1f5f9', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
              <span style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold' }}>Active Code</span>
              <h2 style={{ fontSize: '36px', margin: '4px 0', color: '#1e293b', letterSpacing: '4px' }}>{roomCode}</h2>
            </div>
            <p style={{ marginBottom: '16px', color: '#475569' }}>Welcome, <strong>{name}</strong>! Ready to pick a dining spot?</p>

            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', marginBottom: '24px', textAlign: 'left' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Users size={16} /> Crew Members ({activeUsers.length})
              </h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {activeUsers.map((user) => (
                  <span key={user.id} style={{ background: '#ef4444', color: '#fff', padding: '4px 12px', borderRadius: '20px', fontSize: '14px', fontWeight: '500' }}>
                    ● {user.name}
                  </span>
                ))}
              </div>
            </div>

            <button onClick={() => setView('swiping')} style={{ width: '100%', padding: '14px', background: '#22c55e', color: '#fff', border: '0', borderRadius: '8px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><Utensils size={20} /> Start Swiping Deck</button>
          </div>
        )}

        {view === 'swiping' && restaurants.length > 0 && (
          <div style={{ marginTop: '20px', position: 'relative', height: '360px' }}>
            <AnimatePresence mode="popLayout">
              {restaurants.map((rest, idx) => {
                if (idx !== currentIndex) return null;
                return (
                  <motion.div
                    key={rest.id}
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    onDragEnd={handleDragEnd}
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ 
                      x: idx % 2 === 0 ? 300 : -300, 
                      opacity: 0, 
                      rotate: 15,
                      transition: { duration: 0.2 } 
                    }}
                    style={{
                      position: 'absolute',
                      width: '100%',
                      background: '#ffffff',
                      borderRadius: '16px',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.05)',
                      cursor: 'grab',
                      overflow: 'hidden',
                      zIndex: restaurants.length - idx
                    }}
                  >
                    <img src={rest.image} alt={rest.name} style={{ width: '100%', height: '180px', objectFit: 'cover' }} pointerEvents="none" />
                    
                    <div style={{ padding: '16px', textAlign: 'left' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <h3 style={{ fontSize: '18px', margin: 0, color: '#0f172a' }}>{rest.name}</h3>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '2px', background: '#fef08a', color: '#854d0e', padding: '2px 6px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold' }}>
                          <Star size={12} fill="#854d0e" /> {rest.rating || '4.2'}
                        </span>
                      </div>
                      <p style={{ fontSize: '14px', color: '#64748b', margin: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <MapPin size={14} /> {rest.address || 'Pune, India'}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            
            <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', position: 'absolute', bottom: 0, width: '100%' }}>
              <button onClick={() => handleSwipeAction(false)} style={{ width: '54px', height: '54px', borderRadius: '50%', background: '#fee2e2', border: '0', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }}><X size={24} /></button>
              <button onClick={() => handleSwipeAction(true)} style={{ width: '54px', height: '54px', borderRadius: '50%', background: '#dcfce7', border: '0', color: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }}><Heart size={24} /></button>
            </div>
          </div>
        )}

        {view === 'match' && (
          <div style={{ marginTop: '20px' }}>
            <div style={{ fontSize: '64px', marginBottom: '10px' }}>🎉</div>
            <h2 style={{ color: '#22c55e', fontSize: '28px', margin: '0 0 8px 0' }}>It's a Match!</h2>
            <p style={{ color: '#475569', marginBottom: '20px' }}>Everyone agreed on this dining option:</p>
            <div style={{ background: '#dcfce7', padding: '20px', borderRadius: '12px', border: '2px solid #bbf7d0', marginBottom: '24px' }}>
              <h3 style={{ margin: '0', color: '#166534', fontSize: '22px' }}>{matchedRestaurant}</h3>
            </div>
            <button onClick={fetchFinalResults} style={{ width: '100%', padding: '12px', background: '#3b82f6', color: '#fff', border: '0', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>View Total Votes Table</button>
          </div>
        )}

        {view === 'results' && (
          <div style={{ marginTop: '20px', textAlign: 'left' }}>
            <h2 style={{ fontSize: '22px', textAlign: 'center', margin: '0 0 4px 0', color: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><Award color="#eab308" /> Session Results</h2>
            
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px', marginBottom: '16px', fontSize: '13px' }}>
              <strong style={{ color: '#64748b' }}>Group Progress:</strong>
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                {activeUsers.map(user => {
                  const isDone = user.name === name || finishedUsers.includes(user.name);
                  return (
                    <span key={user.id} style={{ background: isDone ? '#dcfce7' : '#f1f5f9', color: isDone ? '#166534' : '#64748b', padding: '2px 8px', borderRadius: '4px', fontWeight: '500' }}>
                      {user.name} {isDone ? '✅' : '⏳'}
                    </span>
                  );
                })}
              </div>
            </div>

            <p style={{ textAlign: 'center', color: '#64748b', fontSize: '14px', margin: '0 0 20px 0' }}>Here is what the group voted for:</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {results.map((rest, i) => {
                const currentLikes = rest.swipes ? rest.swipes.filter(s => s.isLiked).length : 0;
                // STEP 5: Check if this item matches the top score of the session
                const isTopPick = currentLikes > 0 && currentLikes === highestLikeCount;

                return (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: isTopPick ? '#fefcbf' : '#f1f5f9', border: isTopPick ? '1px solid #f6e05e' : 'none', borderRadius: '8px' }}>
                    <span style={{ fontWeight: '500', color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {rest.name} {isTopPick && <Crown size={16} color="#d69e2e" fill="#d69e2e" />}
                    </span>
                    <span style={{ background: isTopPick ? '#d69e2e' : '#3b82f6', color: '#fff', padding: '4px 10px', borderRadius: '20px', fontSize: '14px', fontWeight: 'bold' }}>
                      {currentLikes} Likes
                    </span>
                  </div>
                );
              })}
            </div>

            <button onClick={() => { setView('landing'); setCurrentIndex(0); setFinishedUsers([]); }} style={{ marginTop: '24px', width: '100%', padding: '12px', background: '#94a3b8', color: '#fff', border: '0', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', textAlign: 'center' }}>Restart Session</button>
          </div>
        )}

      </div>
    </div>
  );
}