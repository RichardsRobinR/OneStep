import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './App.css'
import { signInWithEmail } from './auth'
import { useAuth } from './context/AuthContext'

function App() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { session, loading: authLoading } = useAuth()

  const handleSignIn = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      await signInWithEmail(email)
      navigate('/otp', { state: { email } })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed')
    }
    setLoading(false)
  }

  const handleLogout = async () => {
    await signInWithEmail('')
  }

  // Show loading state while checking auth
  if (authLoading) {
    return (
      <div style={{ padding: '2rem', maxWidth: '400px', margin: '0 auto' }}>
        <h1>OneStepUI</h1>
        <p>Loading...</p>
      </div>
    )
  }

  if (session) {
    console.log('User session:', session) // Debugging line to check session structure
    return (
      <>
        <h1>OneStepUI</h1>
        <section style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
          <h2>Welcome!</h2>
          <p>Email: {session.user.email}</p>
          <p>User ID: {session.user.id}</p>

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '2rem' }}>
            <button
              onClick={() => navigate('/playground')}
              style={{ 
                padding: '0.75rem 1.5rem',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                flex: 1
              }}
            >
              Go to Playground
            </button>
            <button
              onClick={handleLogout}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                flex: 1
              }}
            >
              Logout
            </button>
          </div>
        </section>
      </>
    )
  }

  return (
    <>
      <h1>OneStepUI</h1>
      <section style={{ padding: '2rem', maxWidth: '400px', margin: '0 auto' }}>
        <h2>Sign In</h2>
        <form onSubmit={handleSignIn}>
          <div>
            <label htmlFor="email">Email:</label>
            <input
              id="email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }}
              required
            />
          </div>

          {error && <p style={{ color: 'red', marginTop: '1rem' }}>{error}</p>}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.75rem',
              marginTop: '1rem',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Sending...' : 'Send OTP'}
          </button>
        </form>
      </section>
    </>
  )
}

export default App
