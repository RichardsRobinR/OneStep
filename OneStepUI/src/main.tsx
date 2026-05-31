import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import OTPPage from './pages/OTPPage.tsx'
import AuthCallback from './pages/AuthCallback.tsx'
import PlaygroundPage from './pages/PlaygroundPage.tsx'
import { AuthProvider } from './context/AuthContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/otp" element={<OTPPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/playground" element={<PlaygroundPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
)
