import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../auth'

export default function AuthCallback() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const { data, error } = await supabase.auth.getSession()

        if (error) {
          setError(error.message)
          setTimeout(() => navigate('/'), 3000)
          return
        }

        if (data.session) {
          // Session successfully created, redirect to home
          navigate('/')
        } else {
          setError('No session found')
          setTimeout(() => navigate('/'), 3000)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
        setTimeout(() => navigate('/'), 3000)
      }
    }

    handleCallback()
  }, [navigate])

  return (
    <div style={{ textAlign: 'center', padding: '2rem' }}>
      {error ? (
        <>
          <p style={{ color: 'red' }}>Error: {error}</p>
          <p>Redirecting...</p>
        </>
      ) : (
        <p>Signing you in...</p>
      )}
    </div>
  )
}
