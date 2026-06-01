using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR;

namespace OneStepServer;

public class PlayGroundHub : Hub
{
    private readonly IHubContext<PlayGroundHub> _hubContext;

    public PlayGroundHub(IHubContext<PlayGroundHub> hubContext)
    {
        _hubContext = hubContext;
    }

    public async Task NewMessage(string emailID, string message) =>
        await Clients.All.SendAsync("messageReceived", emailID, message);

    private static readonly ConcurrentDictionary<string, Room> Rooms = new();

    public string CreateRoom()
    {
        var roomId = Guid.NewGuid()
            .ToString("N")
            .Substring(0, 6)
            .ToUpper();

        var room = new Room
        {
            RoomId = roomId,
            HostConnectionId = Context.ConnectionId
        };

        // Populate default game collectible catalog
        room.Items.Add(new AuctionItemState { Id = "1", Name = "Unlimited Coffee", Icon = "☕", Category = "Productivity", Value = 500000 });
        room.Items.Add(new AuctionItemState { Id = "2", Name = "Extra Vacation Day", Icon = "🏖", Category = "Lifestyle", Value = 300000 });
        room.Items.Add(new AuctionItemState { Id = "3", Name = "AI Assistant", Icon = "🤖", Category = "Tech", Value = 800000 });
        room.Items.Add(new AuctionItemState { Id = "4", Name = "Meeting Pass", Icon = "🎫", Category = "Utility", Value = 200000 });

        Rooms.TryAdd(roomId, room);

        return roomId;
    }

    public async Task JoinRoom(string roomId, string email)
    {
        if (!Rooms.TryGetValue(roomId, out var room))
        {
            throw new HubException("Room not found");
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, roomId);

        // Check if player is already added
        var existingPlayer = room.Players.Find(p => p.Email == email);
        if (existingPlayer != null)
        {
            existingPlayer.ConnectionId = Context.ConnectionId;
        }
        else
        {
            room.Players.Add(new Player
            {
                Email = email,
                ConnectionId = Context.ConnectionId,
                IsHost = room.HostConnectionId == Context.ConnectionId
            });
        }

        RecalculatePlayerStats(room);
        await Clients.Group(roomId).SendAsync("PlayersUpdated", room.Players);
        await Clients.Group(roomId).SendAsync("ItemsUpdated", room.Items);
    }

    public async Task StartAuction(string roomId, int duration, int startingCash)
    {
        if (!Rooms.TryGetValue(roomId, out var room))
        {
            throw new HubException("Room not found");
        }

        if (room.HostConnectionId != Context.ConnectionId)
        {
            throw new HubException("Only host can start the auction");
        }

        room.StartingCash = startingCash;
        room.AuctionActive = true;
        room.TimeRemaining = duration;
        room.TimerPaused = false;
        room.CurrentBid = 100000;
        room.HighestBidder = "";

        RecalculatePlayerStats(room);
        await Clients.Group(roomId).SendAsync("PlayersUpdated", room.Players);
        await Clients.Group(roomId).SendAsync("AuctionStarted", room.CurrentItemIndex, duration);

        StartBackgroundTimer(roomId, _hubContext);
    }

    public async Task PauseAuction(string roomId)
    {
        if (Rooms.TryGetValue(roomId, out var room))
        {
            if (room.HostConnectionId != Context.ConnectionId)
            {
                throw new HubException("Only host can pause");
            }
            room.TimerPaused = true;
            await Clients.Group(roomId).SendAsync("AuctionPaused");
        }
    }

    public async Task ResumeAuction(string roomId)
    {
        if (Rooms.TryGetValue(roomId, out var room))
        {
            if (room.HostConnectionId != Context.ConnectionId)
            {
                throw new HubException("Only host can resume");
            }
            room.TimerPaused = false;
            await Clients.Group(roomId).SendAsync("AuctionResumed");
        }
    }

    public async Task NextItem(string roomId)
    {
        if (Rooms.TryGetValue(roomId, out var room))
        {
            if (room.HostConnectionId != Context.ConnectionId)
            {
                throw new HubException("Only host can change items");
            }

            room.TimerCts?.Cancel();

            if (room.CurrentItemIndex < room.Items.Count - 1)
            {
                room.CurrentItemIndex++;
                room.TimeRemaining = 15; // default next round countdown duration
                room.TimerPaused = false;
                room.CurrentBid = 100000;
                room.HighestBidder = "";

                await Clients.Group(roomId).SendAsync("AuctionStarted", room.CurrentItemIndex, room.TimeRemaining);
                StartBackgroundTimer(roomId, _hubContext);
            }
            else
            {
                room.AuctionActive = false;
                await Clients.Group(roomId).SendAsync("AuctionEnded");
            }
        }
    }

    public async Task EndAuction(string roomId)
    {
        if (Rooms.TryGetValue(roomId, out var room))
        {
            if (room.HostConnectionId != Context.ConnectionId)
            {
                throw new HubException("Only host can end the auction");
            }

            room.TimerCts?.Cancel();
            room.AuctionActive = false;

            await Clients.Group(roomId).SendAsync("AuctionEnded");
        }
    }

    public async Task TriggerEndGame(string roomId)
    {
        if (Rooms.TryGetValue(roomId, out var room))
        {
            if (room.HostConnectionId != Context.ConnectionId)
            {
                throw new HubException("Only host can trigger end game results");
            }
            await Clients.Group(roomId).SendAsync("EndGameTriggered");
        }
    }

    public async Task PlaceBid(string roomId, int amount)
    {
        if (Rooms.TryGetValue(roomId, out var room))
        {
            var player = room.Players.Find(p => p.ConnectionId == Context.ConnectionId);
            if (player == null)
            {
                throw new HubException("Player not in room");
            }
            if (player.IsHost)
            {
                throw new HubException("Host connection is not permitted to bid");
            }
            if (amount <= room.CurrentBid)
            {
                throw new HubException("Bidding amount must exceed the current active bid");
            }

            room.CurrentBid = amount;
            room.HighestBidder = player.Email.Split('@')[0];

            await Clients.Group(roomId).SendAsync("BidPlaced", room.HighestBidder, amount);
        }
    }

    public async Task AddItem(string roomId, string name, string category, int value)
    {
        if (Rooms.TryGetValue(roomId, out var room))
        {
            room.Items.Add(new AuctionItemState
            {
                Id = Guid.NewGuid().ToString("N").Substring(0, 8),
                Name = name,
                Icon = GetCategoryIcon(category),
                Category = category,
                Value = value,
                IsSold = false
            });
            await Clients.Group(roomId).SendAsync("ItemsUpdated", room.Items);
        }
    }

    private static string GetCategoryIcon(string category) => category switch
    {
        "Productivity" => "☕",
        "Lifestyle" => "🏖",
        "Tech" => "🤖",
        "Utility" => "🎫",
        "Luxury" => "💎",
        _ => "📦"
    };

    public async Task RemoveItem(string roomId, string itemId)
    {
        if (Rooms.TryGetValue(roomId, out var room))
        {
            room.Items.RemoveAll(i => i.Id == itemId);
            await Clients.Group(roomId).SendAsync("ItemsUpdated", room.Items);
        }
    }

    // Static thread-safe background room timer loop
    private static void StartBackgroundTimer(string roomId, IHubContext<PlayGroundHub> hubContext)
    {
        if (!Rooms.TryGetValue(roomId, out var room)) return;

        room.TimerCts?.Cancel();
        room.TimerCts = new CancellationTokenSource();
        var token = room.TimerCts.Token;

        _ = Task.Run(async () =>
        {
            try
            {
                while (room.TimeRemaining > 0 && !token.IsCancellationRequested)
                {
                    await Task.Delay(1000, token);

                    if (room.TimerPaused) continue;

                    room.TimeRemaining--;

                    // Broadcast timer ticks to group
                    await hubContext.Clients.Group(roomId).SendAsync("TimerTicked", room.TimeRemaining);

                    if (room.TimeRemaining <= 0)
                    {
                        // Declare Item sold to winner
                        var currentItem = room.Items.Count > room.CurrentItemIndex ? room.Items[room.CurrentItemIndex] : null;
                        if (currentItem != null)
                        {
                            currentItem.IsSold = true;
                            currentItem.Winner = room.HighestBidder;
                            currentItem.WinningBid = room.CurrentBid;

                            RecalculatePlayerStats(room);

                            await hubContext.Clients.Group(roomId).SendAsync("ItemSold", room.HighestBidder, room.CurrentBid, currentItem.Name);
                            await hubContext.Clients.Group(roomId).SendAsync("PlayersUpdated", room.Players);
                        }
                        break;
                    }
                }
            }
            catch (OperationCanceledException)
            {
                // Timer cancelled / skipped
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error in SignalR background timer: {ex.Message}");
            }
        }, token);
    }

    private static void RecalculatePlayerStats(Room room)
    {
        foreach (var player in room.Players)
        {
            if (player.IsHost)
            {
                player.Cash = 0;
                player.PortfolioValue = 0;
                player.TotalScore = 0;
                continue;
            }

            string username = player.Email.Split('@')[0];
            int portfolioValue = 0;
            int totalSpent = 0;

            foreach (var item in room.Items)
            {
                if (item.IsSold && item.Winner == username)
                {
                    portfolioValue += item.Value;
                    totalSpent += item.WinningBid;
                }
            }

            player.PortfolioValue = portfolioValue;
            player.Cash = room.StartingCash - totalSpent;
            player.TotalScore = player.Cash + player.PortfolioValue;
        }
    }
}
