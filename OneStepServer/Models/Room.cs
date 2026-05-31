

public class Room
{
    public string RoomId { get; set; } = "";
    public string HostConnectionId { get; set; } = "";

    public List<Player> Players { get; set; } = [];

}

public class Player
{
    public string Email { get; set; } = "";
    public string ConnectionId { get; set; } = "";
    public bool IsHost { get; set; }

}