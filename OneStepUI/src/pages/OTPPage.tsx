import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { verifyOtp } from '../auth'

interface LocationState {
  email?: string
}

export default function OTPPage() {
  const [otp, setOtp] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const email = (location.state as LocationState)?.email || ''

  if (!email) {
    return (
      <div style={{ padding: '2rem', maxWidth: '400px', margin: '0 auto' }}>
        <p style={{ color: 'red' }}>No email provided. Please sign in first.</p>
      </div>
    )
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    console.log('handleVerifyOtp called') // Debug: check if form submit works
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      console.log('Calling verifyOtp with email:', email, 'otp:', otp) // Debug
      const result = await verifyOtp(email, otp)

      console.log('OTP verification result:', result) // Debugging line to check the result structure

      if (result.error) {
        setError(result.error)
      } else {
        // OTP verified successfully, redirect to home
        console.log('OTP verified, redirecting to home') // Debug
        navigate('/')
      }
    } catch (err) {
      console.error('OTP verification error:', err) // Debug
      setError(err instanceof Error ? err.message : 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '400px', margin: '0 auto' }}>
      <h2>Enter OTP</h2>
      <p>We sent a 6-digit code to {email}</p>

      <form onSubmit={handleVerifyOtp}>
        <div>
          <label htmlFor="otp">OTP Code:</label>
          <input
            id="otp"
            type="text"
            placeholder="000000"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }}
          />
        </div>

        {error && <p style={{ color: 'red', marginTop: '1rem' }}>{error}</p>}

        <button
          type="submit"
          style={{
            width: '100%',
            padding: '0.75rem',
            marginTop: '1rem',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Verifying...' : 'Verify OTP'}
        </button>
      </form>
    </div>
  )
}