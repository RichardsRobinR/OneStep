using System.Collections.Generic;
using System.Threading;

public class Room
{
    public string RoomId { get; set; } = "";
    public string HostConnectionId { get; set; } = "";
    public List<Player> Players { get; set; } = [];

    // Live Auction Game State Variables
    public bool AuctionActive { get; set; }
    public int CurrentBid { get; set; } = 100000;
    public string HighestBidder { get; set; } = "";
    public int CurrentItemIndex { get; set; }
    public int TimeRemaining { get; set; }
    public bool TimerPaused { get; set; }
    public List<AuctionItemState> Items { get; set; } = [];
    
    // Cancellation token to manage the background timer thread
    [System.Text.Json.Serialization.JsonIgnore]
    public CancellationTokenSource? TimerCts { get; set; }
}

public class Player
{
    public string Email { get; set; } = "";
    public string ConnectionId { get; set; } = "";
    public bool IsHost { get; set; }
}

public class AuctionItemState
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string Category { get; set; } = "";
    public int Value { get; set; }
    public bool IsSold { get; set; }
    public string Winner { get; set; } = "";
    public int WinningBid { get; set; }
}