using System;
using System.Collections.Concurrent;
using Microsoft.AspNetCore.SignalR;

namespace OneStepServer;

public class PlayGroundHub : Hub
{
    public async Task NewMessage(string emailID, string message) =>
        await Clients.All.SendAsync("messageReceived", emailID, message);


    private static readonly ConcurrentDictionary<string, Room> Rooms = new();

    public string CreateRoom()
    {
        var roomId = Guid.NewGuid()
            .ToString("N")
            .Substring(0, 6)
            .ToUpper();

        Rooms.TryAdd(roomId, new Room
        {
            RoomId = roomId,
            HostConnectionId = Context.ConnectionId
        });

        return roomId;
    }

    public async Task JoinRoom(
    string roomId,
    string email)
    {
    if (!Rooms.TryGetValue(roomId, out var room))
    {
        throw new HubException("Room not found");
    }

    await Groups.AddToGroupAsync(
        Context.ConnectionId,
        roomId);

    room.Players.Add(new Player
    {
        Email = email,
        ConnectionId = Context.ConnectionId,
        IsHost = room.HostConnectionId == Context.ConnectionId
    });

    await Clients.Group(roomId)
    .SendAsync(
        "PlayersUpdated",
        room.Players);
    
    }

    public async Task StartAuction( string roomId) 
    {

            var room = Rooms[roomId];

            if (room.HostConnectionId != Context.ConnectionId)
            {
                throw new HubException("Only host can start");
            }
            
            await Clients.Group(roomId)
                .SendAsync(
                    "AuctionStarted");
    }

    
}
