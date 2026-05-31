import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../auth'
import type { Session } from '@supabase/supabase-js'
// import apiClient from '../services/apiClient'

// interface UserProfile {
//   id: string
//   username: string
//   email: string
//   role: string
//   isOnline: boolean
//   lastConnectedAt: string | null
// }

interface AuthContextType {
  // claims: JwtPayload | null
  // profile: UserProfile | null
  session: Session | null
  loading: boolean
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  // profile: null,
  loading: true,
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  // const [claims, setClaims] = useState<JwtPayload | null>(null)
  // const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)



 useEffect(() => {
  async function initialize() {
    try {
      const { data, error } = await supabase.auth.getSession()

      if (error) {
        console.error(error)
      }

      setSession(data.session)
      console.log('Initial session:', data.session)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  initialize()

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange(
    (_event, session) => {
      console.log('Auth state changed:', _event, session)

      setSession(session)
    }
  )

  return () => subscription.unsubscribe()
}, [])

  return (
    <AuthContext.Provider value={{ session,  loading }}>
      {children}
    </AuthContext.Provider>
  )
}


// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

