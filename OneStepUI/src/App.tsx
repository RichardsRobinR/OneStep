import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './App.css';
import { signInWithEmail } from './auth';
import { useAuth } from './context/AuthContext';

function App() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter a valid email address');
      return;
    }
    setError(null);
    setLoading(true);

    try {
      await signInWithEmail(email);
      // Pass email along in routing state so OTP page has context
      navigate('/otp', { state: { email } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoAccess = () => {
    // Navigate straight to playground as a mock player or mock host
    navigate('/playground', { state: { isDemo: true, email: 'demo.player@auctionwar.com' } });
  };

  if (authLoading) {
    return (
      <div className="loading-box">
        <div className="loading-spinner" />
        <p className="loading-text">Initializing Game Client...</p>
      </div>
    );
  }

  // If user has a real session, show a welcoming dashboard to launch
  if (session) {
    return (
      <div className="view-centered-wrapper">
        <div className="glass-card auth-card">
          <div className="auth-logo-large">👑</div>
          <h1 className="game-title">Welcome Back</h1>
          <p className="game-subtitle">Authenticated as {session.user.email}</p>

          <div className="auth-form">
            <button
              onClick={() => navigate('/playground')}
              className="btn btn-primary"
            >
              Enter Game Lobby
            </button>
            <button
              onClick={async () => {
                await signInWithEmail('');
                navigate('/');
              }}
              className="btn btn-secondary"
            >
              Logout / Disconnect
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="view-centered-wrapper">
      <div className="glass-card auth-card">
        <div className="auction-item-icon auth-logo-large">⚔️</div>
        <h1 className="game-title">Live Auction War</h1>
        <p className="game-subtitle">High-Stakes Real-Time Bidding Game</p>

        <form onSubmit={handleSignIn} className="auth-form">
          <div className="auth-form-field">
            <label htmlFor="email" className="auth-form-label">
              Sign in with Email
            </label>
            <input
              id="email"
              type="email"
              placeholder="your.email@address.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="form-input"
              required
              disabled={loading}
            />
          </div>

          {error && (
            <div className="auth-error-alert">
              ⚠️ {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? 'Transmitting OTP...' : 'Send OTP Code'}
          </button>
        </form>

        <div className="auth-divider-row">
          <span className="auth-divider-line"></span>
          <span className="auth-divider-text">or</span>
          <span className="auth-divider-line"></span>
        </div>

        <button
          onClick={handleDemoAccess}
          className="btn btn-cyan"
        >
          🎮 Enter Demo/Sandbox Mode
        </button>

        <p className="auth-footer-note">
          Review the user interfaces, winner modal, sounds, and leaderboard.
        </p>
      </div>
    </div>
  );
}

export default App;
