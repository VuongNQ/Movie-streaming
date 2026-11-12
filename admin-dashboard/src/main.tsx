import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'

const queryClient = new QueryClient()
const app = <App />

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      {import.meta.env.VITE_GITHUB_PAGES === 'true'
        ? <HashRouter>{app}</HashRouter>
        : <BrowserRouter>{app}</BrowserRouter>}
    </QueryClientProvider>
  </StrictMode>,
)
