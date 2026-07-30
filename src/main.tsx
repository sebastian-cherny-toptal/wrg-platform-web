import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { api } from './api/client'
import { router } from './app/router'
import { StatePanel } from './components/ui'
import { useAppStore } from './store/app-store'
import './styles.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
    mutations: { retry: 0 },
  },
})

function Bootstrap() {
  const [state, setState] = useState<'checking' | 'ready' | 'error'>('checking')
  const setSession = useAppStore((store) => store.setSession)

  useEffect(() => {
    let active = true
    api.session
      .get()
      .then((session) => {
        if (!active) return
        setSession(session)
        setState('ready')
      })
      .catch(() => {
        if (active) setState('error')
      })
    return () => {
      active = false
    }
  }, [setSession])

  if (state === 'checking') {
    return <div className="grid min-h-screen place-items-center bg-zinc-50 p-6"><StatePanel kind="loading" title="Verifying session" message="Confirming your secure sign-in state." /></div>
  }
  if (state === 'error') {
    return <div className="grid min-h-screen place-items-center bg-zinc-50 p-6"><StatePanel kind="error" title="Session check failed" message="The platform could not verify your session. Reload to try again." /></div>
  }
  return <RouterProvider router={router} />
}

const root = document.getElementById('root')
if (!root) throw new Error('Application root was not found')

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Bootstrap />
    </QueryClientProvider>
  </StrictMode>,
)
