import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)

export async function signInWithEmail(email: string) {
  if (!email) {
    // Logout
    await supabase.auth.signOut()
    return { success: true }
  }

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
    },
  })

  if (error) {
    throw new Error(error.message)
  }

  return { success: true }
}

export async function verifyOtp(email: string, token: string) {
  console.log('verifyOtp START - email:', email, 'token:', token)
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  })

  console.log('verifyOtp AFTER Supabase call - error:', error, 'session:', data?.session ? 'YES' : 'NO')

  if (error) {
    console.error('OTP verification error:', error)
    return { error: error.message }
  }

  console.log('OTP verification successful')
  return { success: true, session: data.session }
}