import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { verifyOtp } from '../auth';

interface LocationState {
  email?: string;
}

export default function OTPPage() {
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const email = (location.state as LocationState)?.email || '';

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim()) {
      setError('Please enter the verification code');
      return;
    }

    setError(null);
    setLoading(true);

    try {

      const result = await verifyOtp(email, otp);
      if (result.error) {
        setError(result.error);
      } else {
        navigate('/playground');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="view-centered-wrapper">
      <div className="glass-card auth-card">
        <h1 className="game-title">Verify Identity</h1>
        <p className="game-subtitle"></p>

        {email ? (
          <p className="otp-identity-preview">
            We've transmitted a verification OTP code to <br />
            <strong className="otp-email-highlight">{email}</strong>
          </p>
        ) : (
          <p className="otp-error-unspecified">
            No email address was identified.
          </p>
        )}

        <form onSubmit={handleVerifyOtp} className="auth-form">
          <div className="auth-form-field">
            <label htmlFor="otp" className="auth-form-label">
              One-Time Password
            </label>
            <input
              id="otp"
              type="text"
              placeholder="00000000"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              className="form-input otp-input-field"
              maxLength={8}
              disabled={loading}
              autoFocus
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
            disabled={loading || !email}
          >
            {loading ? (
              <>
                <span className="otp-loader-dot" />
                Verifying...
              </>
            ) : 'Verify OTP'}
          </button>
        </form>

        <div className="otp-action-divider">
          <button
            onClick={() => navigate('/')}
            className="btn btn-secondary"
          >
            Back to Sign In
          </button>
        </div>
      </div>
    </div>
  );
}
