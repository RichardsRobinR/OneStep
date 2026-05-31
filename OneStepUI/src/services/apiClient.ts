import axios from 'axios'
import { supabase } from '../auth'

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
})

// Add JWT token to every request (only after user is authenticated)
apiClient.interceptors.request.use(async (config) => {
  try {
    const { data } = await supabase.auth.getSession()
    if (data.session?.access_token) {
      config.headers.Authorization = `Bearer ${data.session.access_token}`
      console.log('Authorization header added') // Debug
    } else {
      console.warn('No session found for API request')
    }
  } catch (error) {
    console.warn('Failed to get session for API request:', error)
  }
  return config
})

export default apiClient
