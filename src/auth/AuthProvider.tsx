import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

type AuthContextValue = {
  ready: boolean
  session: Session | null
  user: User | null
  refreshMediaSession: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function syncMediaSession(session: Session | null) {
  if (!session) return
  const response = await fetch('/v1/auth/media-session', {
    method: 'POST',
    credentials: 'include',
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  if (!response.ok) throw new Error('Unable to establish the private media session')
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)

  const refreshMediaSession = useCallback(async () => {
    const { data, error } = await supabase.auth.getSession()
    if (error) throw error
    await syncMediaSession(data.session)
  }, [])

  useEffect(() => {
    let active = true
    void supabase.auth.getSession().then(async ({ data, error }) => {
      if (!active) return
      if (error) console.error('Unable to restore Supabase session', error)
      setSession(data.session)
      if (data.session) await syncMediaSession(data.session).catch(console.error)
      if (active) setReady(true)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!active) return
      setSession(next)
      setReady(true)
      if (next) void syncMediaSession(next).catch(console.error)
    })
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refreshMediaSession().catch(() => {})
    }, 20 * 60 * 1000)
    return () => {
      active = false
      window.clearInterval(timer)
      listener.subscription.unsubscribe()
    }
  }, [refreshMediaSession])

  const signOut = useCallback(async () => {
    await fetch('/v1/auth/media-session', { method: 'DELETE', credentials: 'include', headers: session ? { Authorization: `Bearer ${session.access_token}` } : undefined }).catch(() => {})
    await supabase.auth.signOut({ scope: 'local' })
  }, [session])

  const value = useMemo<AuthContextValue>(() => ({ ready, session, user: session?.user ?? null, refreshMediaSession, signOut }), [ready, session, refreshMediaSession, signOut])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used within AuthProvider')
  return value
}
