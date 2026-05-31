import { useEffect, useState } from 'react'
// import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import apiClient from '../services/apiClient'
import { connection , signalRService } from '../services/HubConnectionBuilder'



interface Player {
    email: string;
    connectionId: string;
    isHost: boolean;
}

export default function PlaygroundPage() {
//   const navigate = useNavigate()
  const { session } = useAuth()
const [players, setPlayers] = useState<Player[]>([]);
const [isJoined, setIsJoined] = useState(false);


  useEffect(() => {
    // if (!session) {
    //   navigate('/')
    //   return
    // }

            const connect = async () => {
                try {
                await signalRService.start();

                connection.on(
                    "messageReceived",
                    (username: string, message: string) => {
                    console.log(username, message);
                    }
                );

                connection.on(
                    "PlayersUpdated",
                    playersList => {
                        setPlayers(playersList);
                    });



                } catch (error) {
                console.error(error);
                }
            };

  connect();

  return () => {
    connection.off("messageReceived");
    connection.off("PlayersUpdated");
  };
  }, [])


  const joinRoom = async (roomId: string) => {
    try {
      await connection.invoke('JoinRoom', roomId, session?.user.email)
      console.log('Joined room:', roomId);
        setIsJoined(true);
    } catch (error) {
      console.error('Failed to join room:', error)
    }
  }

  const [roonmId, setRoomId] = useState('');
  const createRoom = async () => {
    try {
      const roomId = await connection.invoke("CreateRoom");
      console.log('Created room with ID:', roomId);
        return roomId;
    } catch (error) {
      console.error('Failed to create room:', error)
    }
  }

    const createRoomAndJoin = async () => {
            try {
                const roomId = await createRoom();

                setRoomId(roomId);

                await joinRoom(roomId);
            }
            catch (err) {
                console.error(err);
            }
    }

  const sendMessage = async () => {
    try {
      await connection.invoke('NewMessage', session?.user.email, 'Hello from Playground!')
    } catch (error) {
      console.error('Failed to send message:', error)
    }
  }

  const fetchProfile = async () => {
    try {
      const response = await apiClient.get('/api/account/profile')
      console.log('Profile response:', response.data)
    } catch (error) {
      console.error('Failed to fetch profile:', error)
    }
  }

  if (!session) {
    return null
  }

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Playground</h1>

      <section
        style={{
          backgroundColor: '#f5f5f5',
          padding: '2rem',
          borderRadius: '8px',
          marginBottom: '2rem',
        }}
      >
        <h2>Welcome to Playground</h2>
        <p>
          <strong>Email:</strong> {session.user.email}
        </p>
        <p>
          <strong>User ID:</strong> {session.user.id}
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2>Features</h2>

        {!isJoined && (
                        <>
                            <button onClick={createRoomAndJoin} style={{ marginRight: '1rem' }}>
                                Create Room
                            </button>
                                <input
                                type="text"
                                placeholder="Room ID"
                                    onChange={(e) => {
                                        if (e.target.value.length >= 6) {
                                            setRoomId(e.target.value);
                                        }
                                    
                                    }}
                                    style={{ padding: '0.5rem', marginRight: '1rem' }}
                                />
                            <button onClick={() => joinRoom(roonmId)} style={{ marginRight: '1rem' }}>
                                Join Room
                            </button>
                        </>
        )}

        <button onClick={fetchProfile}>
          Fetch Profile
        </button>
         <button onClick={sendMessage}>
          Send Message
        </button>
      </section>

      <section>
        <h2>Players in Room</h2>
        {players.length === 0 ? (
          <p>No players in the room yet.</p>
        ) : (
          <ul>
            {players.map((player) => (
                <li key={player.connectionId}>
                    {player.email} {player.isHost && '(Host)'}
                </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>Game Area</h2>
        <p>This is where the game will be displayed.</p>
        <h1></h1>
      </section>
    </div>
  )
}