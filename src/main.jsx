// src/main.jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { Analytics } from '@vercel/analytics/react'
import 'maplibre-gl/dist/maplibre-gl.css'
import '@bark/ui/style.css'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
      <Toaster
        position="bottom-center"
        toastOptions={{
          style: {
            background: 'rgba(15, 15, 18, 0.95)',
            color: '#f5f5f5',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          },
        }}
      />
      <Analytics />
    </BrowserRouter>
  </StrictMode>,
)
