import './utils/theme'
import './styles/theme.css'
import { Toaster } from 'react-hot-toast'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/dropdowns.css'
import App from './App.tsx'
import AppErrorBoundary from './components/AppErrorBoundary.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
      <Toaster position="top-right" containerStyle={{ zIndex: 20000 }} toastOptions={{ duration: 4500, style: { border: '1px solid var(--ui-border, #e1e7ee)', background: 'var(--ui-surface, #fff)', borderRadius: '9px', padding: '12px 16px', fontSize: '13px', color: 'var(--ui-text, #344456)', maxWidth: '400px', boxShadow: '0 8px 30px #1736501a' }, success: { iconTheme: { primary: '#27835a', secondary: '#fff' } } }} />
    </AppErrorBoundary>
  </StrictMode>,
)
