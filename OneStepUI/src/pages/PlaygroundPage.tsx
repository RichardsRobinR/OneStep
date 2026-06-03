import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Confetti from '../components/Confetti';
import { sounds } from '../lib/soundEffects';
import { useAuth } from '../context/AuthContext';
import { connection, signalRService } from '../services/HubConnectionBuilder';

interface Player {
  email: string;
  connectionId: string;
  isHost: boolean;
  cash?: number;
  portfolioValue?: number;
  totalScore?: number;
}

interface AuctionItem {
  id: string;
  name: string;
  icon: string;
  category: string;
  value: number;
  isSold: boolean;
  winner?: string;
  winningBid?: number;
}

export default function PlaygroundPage() {
  const navigate = useNavigate();
  const { session } = useAuth();

  // Active Game & Connection State
  const [roomState, setRoomState] = useState<'none' | 'lobby' | 'live' | 'leaderboard' | 'end_game'>('none');
  const [roomId, setRoomId] = useState('');
  const [players, setPlayers] = useState<Player[]>([]);
  
  // Game Settings (Host Configurable)
  const [startingCash, setStartingCash] = useState(1000000);
  const [auctionDuration, setAuctionDuration] = useState(15);

  // Auction Items Catalog (populated dynamically from the server)
  const [items, setItems] = useState<AuctionItem[]>([]);

  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('Productivity');
  const [newItemValue, setNewItemValue] = useState(100000);

  // Live Auction State
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [timer, setTimer] = useState(15);
  const [timerRunning, setTimerRunning] = useState(false);
  const [currentBid, setCurrentBid] = useState(100000);
  const [highestBidder, setHighestBidder] = useState('');
  const [customBid, setCustomBid] = useState('');

  // Interactive Activity Log
  const [activityFeed, setActivityFeed] = useState<string[]>([]);
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [winnerInfo, setWinnerInfo] = useState<{ winner: string; bid: number; item: string } | null>(null);
  const [isConfettiActive, setIsConfettiActive] = useState(false);


  // Connect to SignalR Hub and setup real-time listeners
  useEffect(() => {
    const connectHub = async () => {
      try {
        await signalRService.start();
        
        // Listeners for real-time server messages
        connection.on("PlayersUpdated", (playersList: Player[]) => {
          console.log("Real-time Players updated from server:", playersList);
          setPlayers(playersList);
        });

        connection.on("messageReceived", (username: string, message: string) => {
          setActivityFeed((prev) => [`[Chat] ${username}: ${message}`, ...prev]);
        });

        // Add additional event listeners for real-time auction synchronization
        connection.on("AuctionStarted", (itemIndex: number, startTimer: number) => {
          setRoomState('live');
          setTimerRunning(true);
          setCurrentBid(100000);
          setHighestBidder('');
          setShowWinnerModal(false);
          setIsConfettiActive(false);
          setCurrentItemIndex(itemIndex);
          setTimer(startTimer);
          setActivityFeed((prev) => [`Auction round for item ${itemIndex + 1} started`, ...prev]);
          sounds.playStart();
        });

        connection.on("AuctionPaused", () => {
          setTimerRunning(false);
          setActivityFeed((prev) => [`Auction paused by Host`, ...prev]);
        });

        connection.on("AuctionResumed", () => {
          setTimerRunning(true);
          setActivityFeed((prev) => [`Auction resumed by Host`, ...prev]);
        });

        connection.on("AuctionEnded", () => {
          setRoomState('leaderboard');
          setTimerRunning(false);
          setActivityFeed((prev) => [`Auction ended. Moving to leaderboard.`, ...prev]);
        });

        connection.on("BidPlaced", (bidder: string, bidAmount: number) => {
          setCurrentBid(bidAmount);
          setHighestBidder(bidder);
          sounds.playBid();
          setActivityFeed((prev) => [`${bidder} placed a bid of ₹${bidAmount.toLocaleString()}`, ...prev]);
        });

        connection.on("TimerTicked", (secondsLeft: number) => {
          setTimer(secondsLeft);
          if (secondsLeft <= 5) {
            sounds.playWarning();
          }
        });

        connection.on("ItemSold", (winnerName: string, winningAmount: number, itemName: string) => {
          setWinnerInfo({ winner: winnerName, bid: winningAmount, item: itemName });
          setShowWinnerModal(true);
          
          if (winnerName) {
            setIsConfettiActive(true);
            sounds.playWinner();
          } else {
            setIsConfettiActive(false);
            sounds.playWarning();
          }
          
          // Update item sold status in catalog
          setItems((prevItems) =>
            prevItems.map((item) =>
              item.name === itemName
                ? { ...item, isSold: true, winner: winnerName, winningBid: winningAmount }
                : item
            )
          );
        });

        connection.on("ItemsUpdated", (updatedItems: AuctionItem[]) => {
          console.log("Real-time items updated from server:", updatedItems);
          setItems(updatedItems);
        });

        connection.on("EndGameTriggered", () => {
          setRoomState('end_game');
          sounds.playWinner();
        });

      } catch (err) {
        console.error("SignalR Hub connection failed:", err);
      }
    };

    connectHub();

    return () => {
      connection.off("PlayersUpdated");
      connection.off("messageReceived");
      connection.off("AuctionStarted");
      connection.off("AuctionPaused");
      connection.off("AuctionResumed");
      connection.off("AuctionEnded");
      connection.off("EndGameTriggered");
      connection.off("BidPlaced");
      connection.off("TimerTicked");
      connection.off("ItemSold");
      connection.off("ItemsUpdated");
    };
  }, []);

  // Determine if the current client is the room host
  const isHost = players.find(p => p.email === session?.user?.email)?.isHost ?? false;

  // Create Room Invoke
  const handleCreateRoom = async () => {
    try {
      const generatedRoomId = await connection.invoke("CreateRoom");
      if (generatedRoomId) {
        setRoomId(generatedRoomId);
        setRoomState('lobby');
        setActivityFeed((prev) => [`Room ${generatedRoomId} created`, ...prev]);
        
        // Auto join after creation
        await connection.invoke("JoinRoom", generatedRoomId, session?.user?.email);
      }
    } catch (err) {
      console.error("Failed to create room via server:", err);
    }
  };

  // Join Room Invoke
  const handleJoinRoom = async () => {
    if (!roomId.trim()) return;
    try {
      await connection.invoke("JoinRoom", roomId.toUpperCase(), session?.user?.email);
      setRoomState('lobby');
      setActivityFeed((prev) => [`Joined room ${roomId.toUpperCase()}`, ...prev]);
    } catch (err) {
      console.error("Failed to join room via server:", err);
    }
  };

  // Start Auction
  const handleStartAuction = async () => {
    try {
      await connection.invoke("StartAuction", roomId, auctionDuration, startingCash);
    } catch (err) {
      console.error("Hub StartAuction failed:", err);
    }
  };

  // Control Actions
  const handlePauseAuction = async () => {
    try {
      await connection.invoke("PauseAuction", roomId);
    } catch (err) {
      console.error("Hub PauseAuction failed:", err);
    }
  };

  const handleResumeAuction = async () => {
    try {
      await connection.invoke("ResumeAuction", roomId);
    } catch (err) {
      console.error("Hub ResumeAuction failed:", err);
    }
  };

  const handleEndAuction = async () => {
    try {
      await connection.invoke("EndAuction", roomId);
    } catch (err) {
      console.error("Hub EndAuction failed:", err);
    }
  };

  const handleNextItem = async () => {
    setShowWinnerModal(false);
    setIsConfettiActive(false);
    try {
      await connection.invoke("NextItem", roomId);
    } catch (err) {
      console.error("Hub NextItem failed:", err);
    }
  };

  const handleTriggerEndGame = async () => {
    try {
      await connection.invoke("TriggerEndGame", roomId);
    } catch (err) {
      console.error("Hub TriggerEndGame failed:", err);
    }
  };

  // Place Bid
  const handlePlaceBid = async (amount: number) => {
    if (amount <= currentBid) return;
    
    const playerCash = players.find(p => p.email === session?.user?.email)?.cash ?? startingCash;
    if (amount > playerCash) {
      alert("Bidding amount exceeds your remaining cash balance!");
      return;
    }

    try {
      await connection.invoke("PlaceBid", roomId, amount);
    } catch (err: unknown) {
      alert((err as Error)?.message || "Failed to place bid");
      console.error("Hub PlaceBid failed:", err);
    }
  };

  const handleQuickBid = (increment: number) => {
    handlePlaceBid(currentBid + increment);
  };

  const handleCustomBidSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(customBid.replace(/,/g, ''), 10);
    if (isNaN(parsed) || parsed <= currentBid) return;
    handlePlaceBid(parsed);
    setCustomBid('');
  };

  // Add Item to Catalog
  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    try {
      await connection.invoke("AddItem", roomId, newItemName, newItemCategory, newItemValue);
      setNewItemName('');
    } catch (err) {
      console.error("Failed to invoke AddItem on server:", err);
    }
  };

  const handleRemoveItem = async (id: string) => {
    try {
      await connection.invoke("RemoveItem", roomId, id);
    } catch (err) {
      console.error("Failed to invoke RemoveItem on server:", err);
    }
  };

  // Setup list for endgame ranking (server-calculated)
  const sortedLeaderboard = [...players].sort((a, b) => {
    return (b.totalScore ?? 0) - (a.totalScore ?? 0);
  });

  return (
    <div className="app-container">
      {/* Confetti canvas */}
      <Confetti active={isConfettiActive} />

      {/* Main Viewport Grid */}
      <div className="playground-viewport">
        
        {/* Header Bar */}
        <header className="playground-header">
          <div>
            <h2 className="playground-header-title">
              OneStep
            </h2>
            {/* <p className="playground-header-subtitle">
              Real-time workspace collectibles bidding simulation
            </p> */}
          </div>
          {roomState !== 'none' && (
            <div className="playground-header-controls">
              <div className="badge badge-host playground-header-badge">
                {isHost ? 'Host Mode 👑' : 'Player View 👤'}
              </div>
              <button
                onClick={() => {
                  setRoomState('none');
                  navigate('/');
                }}
                className="btn btn-secondary playground-header-exit"
              >
                Disconnect
              </button>
            </div>
          )}
        </header>

        {/* 1. Portal Lobby Screen (None State) */}
        {roomState === 'none' && (
          <div className="portal-container">
            <div className="portal-grid">
              
              {/* Host Room Creation Card */}
              <div className="glass-card lobby-host-config">
                <div>
                  <div className="portal-card-head-icon">👑</div>
                  <h2 className="portal-card-head-title">Host a Game</h2>
                  <p className="portal-card-body-text">
                    Generate a secure battle room ID, define player wallets, schedule durations, configure collectibles catalog, and steer the auction.
                  </p>
                </div>
                <button onClick={handleCreateRoom} className="btn btn-primary">
                  Create Room
                </button>
              </div>

              {/* Player Join Room Card */}
              <div className="glass-card neon-cyan auth-form">
                <div className="text-center">
                  <div className="portal-card-head-icon">🎮</div>
                  <h2 className="portal-card-head-title">Join a Game</h2>
                  <p className="portal-card-body-text">
                    Enter an active Room ID code shared by the host, configure your lobby handle, and bid against coworkers.
                  </p>
                </div>
                <div className="portal-inputs-wrapper">
                  <div className="portal-input-field">
                    <label className="portal-input-label">Room ID</label>
                    <input
                      type="text"
                      placeholder="e.g. AB12CD"
                      value={roomId}
                      onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                      className="form-input"
                      maxLength={6}
                    />
                  </div>
                </div>
                <button onClick={handleJoinRoom} className="btn btn-cyan">
                  Join Room
                </button>
              </div>

            </div>
          </div>
        )}

        {/* GAME PANELS (Lobby / Live / Leaderboard) */}
        {roomState !== 'none' && (
          <div className="game-layout">
            
            {/* Left Column: Game Area */}
            <div className="live-auction-column">
              
              {/* PHASE 2: ROOM LOBBY SCREEN */}
              {roomState === 'lobby' && (
                <>
                  {isHost ? (
                    /* HOST LOBBY CONFIGURATION SCREEN */
                    <div className="glass-card lobby-host-config">
                      
                      {/* Room ID display */}
                      <div className="lobby-host-header">
                        <div>
                          <div className="lobby-host-subtitle">Host Room Manager</div>
                          <div className="lobby-host-room-info">
                            <span className="lobby-host-room-id">Room: {roomId || 'AB12CD'}</span>
                          </div>
                        </div>
                        <div className="lobby-host-players-col">
                          <span className="lobby-host-players-label">Connected Players:</span>
                          <div className="lobby-host-players-count">{players.length} Active</div>
                        </div>
                      </div>

                      {/* Configurations */}
                      <div>
                        <h3 className="lobby-sub-heading">
                          ⚙️ Rules Configuration
                        </h3>
                        <div className="lobby-rules-grid">
                          <div className="lobby-rules-field">
                            <label className="lobby-rules-label">Starting Cash per Player</label>
                            <input
                              type="number"
                              value={startingCash}
                              onChange={(e) => setStartingCash(parseInt(e.target.value, 10))}
                              className="form-input"
                            />
                          </div>
                          <div className="lobby-rules-field">
                            <label className="lobby-rules-label">Auction Duration (seconds)</label>
                            <input
                              type="number"
                              value={auctionDuration}
                              onChange={(e) => setAuctionDuration(parseInt(e.target.value, 10))}
                              className="form-input"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Items Management */}
                      <div>
                        <h3 className="lobby-sub-heading">
                          📦 Collectible Items Catalog ({items.length})
                        </h3>
                        
                        {/* Add Item form */}
                        <form onSubmit={handleAddItem} className="lobby-items-form">
                          <input
                            type="text"
                            placeholder="Add item name (e.g. Unlimited Coffee)"
                            value={newItemName}
                            onChange={(e) => setNewItemName(e.target.value)}
                            className="form-input lobby-items-form-name"
                          />
                          <select
                            value={newItemCategory}
                            onChange={(e) => setNewItemCategory(e.target.value)}
                            className="form-input lobby-items-form-select"
                          >
                            <option value="Productivity">Productivity</option>
                            <option value="Lifestyle">Lifestyle</option>
                            <option value="Tech">Tech</option>
                            <option value="Utility">Utility</option>
                            <option value="Luxury">Luxury</option>
                          </select>
                          <input
                            type="number"
                            placeholder="Value"
                            value={newItemValue}
                            onChange={(e) => setNewItemValue(parseInt(e.target.value, 10))}
                            className="form-input lobby-items-form-val"
                          />
                          <button type="submit" className="btn btn-cyan">
                            Add Item
                          </button>
                        </form>

                        {/* List */}
                        <div className="lobby-items-list-container">
                          {items.map((item) => (
                            <div key={item.id} className="lobby-item-row">
                              <div className="lobby-item-details">
                                <span className="lobby-item-icon">{item.icon}</span>
                                <span className="lobby-item-name">{item.name}</span>
                                <span className="badge badge-category lobby-item-badge-text">{item.category}</span>
                              </div>
                              <div className="lobby-item-meta">
                                <span className="lobby-item-value-text">
                                  Val: ₹{item.value.toLocaleString()}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(item.id)}
                                  className="lobby-item-remove-action"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Control Panel */}
                      <div className="lobby-controls-footer">
                        <button onClick={handleStartAuction} className="btn btn-primary lobby-controls-start-btn">
                          🚀 Start Game Auction
                        </button>
                        <button onClick={() => setRoomState('none')} className="btn btn-secondary">
                          Cancel
                        </button>
                      </div>

                    </div>
                  ) : (
                    /* PLAYER WAITING ROOM SCREEN */
                    <div className="glass-card neon-cyan lobby-player-waiting-view">
                      <div className="auction-item-icon lobby-player-waiting-icon">🛡️</div>
                      <h2 className="lobby-player-waiting-title">Waiting Room</h2>
                      <p className="lobby-player-waiting-room-id">
                        Room ID: {roomId || 'AB12CD'}
                      </p>

                      <div className="lobby-player-waiting-msg-box">
                        Waiting for auction to start...
                      </div>

                      <div className="lobby-player-chips-wrapper">
                        <h4 className="lobby-player-chips-title">
                          Connected Players ({players.length}):
                        </h4>
                        <div className="lobby-player-chips-flex">
                          {players.map((p, idx) => (
                            <span key={idx} className="lobby-player-chip-badge">
                              {p.isHost ? '👑' : '👤'} {p.email.split('@')[0]}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* PHASE 3: LIVE AUCTION SCREEN */}
              {roomState === 'live' && (
                items.length === 0 ? (
                  <div className="glass-card loading-box">
                    <div className="loading-spinner" />
                    <p className="loading-text">Syncing items from server...</p>
                  </div>
                ) : (
                  <div className="live-auction-column">
                  
                  {/* Hero Item & Timer Card */}
                  <div className="glass-card live-auction-card">
                    
                    <div className="live-auction-header">
                      <div className="badge badge-category">
                        Item {currentItemIndex + 1} of {items.length} • {items[currentItemIndex].category}
                      </div>
                      <div className="live-auction-timer-col">
                        <span className="live-auction-timer-label">Time Left</span>
                        <div className={`auction-timer live-auction-timer-display ${timer <= 5 ? 'danger' : ''}`}>
                          00:{timer < 10 ? `0${timer}` : timer}
                        </div>
                      </div>
                    </div>

                    <div className="live-item-hero">
                      <div className="live-item-icon">{items[currentItemIndex].icon}</div>
                      <h2 className="live-item-name">{items[currentItemIndex].name}</h2>
                    </div>

                    {/* Current Bid Display */}
                    <div className="live-bid-summary-grid">
                      <div className="live-bid-display-box">
                        <span className="live-player-wallet-label">Current Bid</span>
                        <div className="bid-value">₹{currentBid.toLocaleString()}</div>
                      </div>
                      <div className="live-bid-display-box">
                        <span className="live-player-wallet-label">Leading Bidder</span>
                        <div className="live-bidder-name">
                          {highestBidder ? highestBidder : 'None'}
                        </div>
                      </div>
                    </div>

                    {/* Bidding Controls */}
                    {!isHost ? (
                      <div>
                        <div className="live-player-wallet-row">
                          <span className="live-player-wallet-label">Cash Remaining:</span>
                          <span className="live-player-wallet-value">
                            ₹{(players.find(p => p.email === session?.user?.email)?.cash ?? startingCash).toLocaleString()}
                          </span>
                        </div>

                        {/* Quick Bid Buttons */}
                        <div className="live-quick-bid-toolbar">
                          <button onClick={() => handleQuickBid(10000)} className="btn btn-secondary live-quick-bid-btn">+10K</button>
                          <button onClick={() => handleQuickBid(50000)} className="btn btn-secondary live-quick-bid-btn">+50K</button>
                          <button onClick={() => handleQuickBid(100000)} className="btn btn-secondary live-quick-bid-btn">+100K</button>
                          <button onClick={() => handleQuickBid(250000)} className="btn btn-secondary live-quick-bid-btn">+250K</button>
                        </div>

                        {/* Custom Bid form */}
                        <form onSubmit={handleCustomBidSubmit} className="live-custom-bid-form">
                          <input
                            type="text"
                            placeholder="Enter Amount"
                            value={customBid}
                            onChange={(e) => setCustomBid(e.target.value)}
                            className="form-input live-custom-bid-input"
                          />
                          <button type="submit" className="btn btn-primary live-custom-bid-submit">
                            Place Bid
                          </button>
                        </form>
                      </div>
                    ) : (
                      /* HOST CONTROL CONSOLE */
                      <div className="otp-action-divider">
                        <div className="live-host-controls-title">
                          Auction Control Panel
                        </div>
                        <div className="live-host-controls-row">
                          {timerRunning ? (
                            <button onClick={handlePauseAuction} className="btn btn-rose live-host-controls-btn">
                              Pause Auction
                            </button>
                          ) : (
                            <button onClick={handleResumeAuction} className="btn btn-cyan live-host-controls-btn">
                              Resume Auction
                            </button>
                          )}
                          <button onClick={handleNextItem} className="btn btn-secondary live-host-controls-btn">
                            Next Item
                          </button>
                          <button onClick={handleEndAuction} className="btn btn-rose">
                            End Auction
                          </button>
                        </div>
                      </div>
                    )}

                  </div>

                  {/* Player Inventory (Only for players) */}
                  {!isHost && (
                    <div className="glass-card neon-cyan live-inventory-panel">
                      <h4 className="live-inventory-title">
                        Owned Items
                      </h4>
                      <div className="live-inventory-grid">
                        <div className="live-inventory-card">
                          <span className="live-inventory-card-label">Cash Remaining</span>
                          <div className="live-inventory-card-value">
                            ₹{(players.find(p => p.email === session?.user?.email)?.cash ?? startingCash).toLocaleString()}
                          </div>
                        </div>
                        <div className="live-inventory-card">
                          <span className="live-inventory-card-label">Collectibles Portfolio</span>
                          <div className="live-inventory-portfolio-items">
                            {items.filter(i => i.winner === (session?.user?.email?.split('@')[0] ?? '') && i.isSold).length === 0 ? (
                              <span className="live-inventory-portfolio-empty">No items won yet</span>
                            ) : (
                              <div className="live-inventory-portfolio-icons">
                                {items.filter(i => i.winner === (session?.user?.email?.split('@')[0] ?? '') && i.isSold).map((item) => (
                                  <span key={item.id} title={item.name}>{item.icon}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                </div>
                )
              )}

              {/* PHASE 4: LEADERBOARD SCREEN */}
              {roomState === 'leaderboard' && (
                <div className="glass-card leaderboard-view">
                  <div className="leaderboard-head-section">
                    <div className="leaderboard-head-icon">📊</div>
                    <h2 className="leaderboard-head-title">Leaderboard Screen</h2>
                    <p className="leaderboard-head-subtitle">Rankings based on wealth assets and scores</p>
                  </div>

                  <table className="leaderboard-table">
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>Player</th>
                        <th>Cash Remaining</th>
                        <th>Portfolio Value</th>
                        <th>Total Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedLeaderboard.map((p, idx) => {
                        const portfolioVal = p.portfolioValue ?? 0;
                        const cashVal = p.cash ?? startingCash;
                        const score = p.totalScore ?? cashVal;
                        return (
                          <tr key={p.connectionId || idx} className={`leaderboard-row ${idx === 0 ? 'gold-rank' : ''}`}>
                            <td className="font-weight-bold">{idx + 1}</td>
                            <td>{p.email.split('@')[0]} {idx === 0 && '👑'}</td>
                            <td className="font-family-mono">₹{cashVal.toLocaleString()}</td>
                            <td className="font-family-mono">₹{portfolioVal.toLocaleString()}</td>
                            <td className="font-family-mono font-weight-bold">₹{score.toLocaleString()}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {isHost && (
                    <div className="leaderboard-controls-row">
                      <button onClick={handleTriggerEndGame} className="btn btn-primary leaderboard-controls-trigger-btn">
                        Trigger End Game Results Screen
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* PHASE 5: END GAME RESULTS SCREEN */}
              {roomState === 'end_game' && (
                <div className="glass-card endgame-card">
                  <div className="trophy-glow">🏆</div>
                  <h1 className="game-title endgame-winner-title">Championship Winner</h1>
                  
                  {/* Winner display */}
                  <h2 className="endgame-winner-name">
                    {sortedLeaderboard[0]?.email.split('@')[0]}
                  </h2>

                  {/* Summary Breakdown */}
                  <div className="endgame-breakdown-panel">
                    <h3 className="endgame-breakdown-heading">
                      Portfolio Breakdown
                    </h3>
                    
                    <div className="endgame-stats-list">
                      <div className="endgame-stats-row">
                        <span className="endgame-stats-label">Cash Remaining:</span>
                        <span className="endgame-stats-value">
                          ₹{(sortedLeaderboard[0]?.cash ?? startingCash).toLocaleString()}
                        </span>
                      </div>
                      
                      <div className="endgame-stats-row">
                        <span className="endgame-stats-label">Portfolio Total:</span>
                        <span className="endgame-stats-value text-secondary">
                          ₹{(sortedLeaderboard[0]?.portfolioValue ?? 0).toLocaleString()}
                        </span>
                      </div>

                      {/* Portfolio break-down list */}
                      <div className="endgame-portfolio-sublist">
                        {items
                          .filter((i) => i.winner === (sortedLeaderboard[0]?.email?.split('@')[0] ?? '') && i.isSold)
                          .map((item) => (
                            <div key={item.id} className="endgame-portfolio-row">
                              <span>{item.name} (Value: ₹{item.value.toLocaleString()}):</span>
                              <span>Bid: ₹{(item.winningBid || 0).toLocaleString()}</span>
                            </div>
                          ))}
                        {items.filter((i) => i.winner === (sortedLeaderboard[0]?.email?.split('@')[0] ?? '') && i.isSold).length === 0 && (
                          <span className="endgame-portfolio-empty">No items won</span>
                        )}
                      </div>

                      <div className="endgame-total-score-row">
                        <span className="endgame-total-score-label">Final Score:</span>
                        <span className="endgame-total-score-val">
                          ₹{(sortedLeaderboard[0]?.totalScore ?? 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="endgame-controls-row">
                    <button onClick={() => navigate('/')} className="btn btn-secondary">
                      Exit Game
                    </button>
                  </div>
                </div>
              )}

            </div>

            {/* Right Column: Activity Feed Panel */}
            <div className="activity-feed-card glass-card">
              <h3 className="sidebar-feed-title">
                <span className="sidebar-feed-bullet">●</span> Real-Time Activity Feed
              </h3>
              
              <div className="activity-feed-list">
                {activityFeed.map((item, idx) => (
                  <div key={idx} className="activity-item">
                    {item}
                  </div>
                ))}
              </div>

              <div className="sidebar-feed-footer">
                Live stream of auction events
              </div>
            </div>

          </div>
        )}

      </div>

      {/* Auction Winner Modal */}
      {showWinnerModal && winnerInfo && (
        <div className="modal-overlay">
          <div className="modal-content">
            {winnerInfo.winner ? (
              <>
                <div className="modal-trophy">🏆</div>
                <div className="modal-title">Winner</div>
                
                <div className="modal-details">
                  <div className="modal-detail-value-large">
                    {winnerInfo.winner.split('@')[0]}
                  </div>

                  <div className="modal-detail-label-margin">Winning Bid</div>
                  <div className="modal-detail-value-mid">
                    ₹{winnerInfo.bid.toLocaleString()}
                  </div>

                  <div className="modal-detail-label-margin">Item Won</div>
                  <div className="modal-detail-value-text">
                    {winnerInfo.item}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="modal-trophy">📦</div>
                <div className="modal-title">Unsold</div>
                
                <div className="modal-details">
                  <div className="modal-detail-value-large">
                    No Bids Placed
                  </div>

                  <div className="modal-detail-label-margin">Collectible Item</div>
                  <div className="modal-detail-value-text">
                    {winnerInfo.item}
                  </div>

                  <div className="modal-detail-label-margin">Status</div>
                  <div className="modal-detail-value-text">
                    This item has passed without any active bids from players.
                  </div>
                </div>
              </>
            )}

            <button
              onClick={() => {
                setShowWinnerModal(false);
                setIsConfettiActive(false);
              }}
              className="btn btn-cyan modal-btn-submit"
            >
              Continue
            </button>
          </div>
        </div>
      )}

    </div>
  );
}