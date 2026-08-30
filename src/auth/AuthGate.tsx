import { useEffect, useState, type FormEvent, type PropsWithChildren, type ReactNode } from 'react'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { supabase, supabaseConfigured } from '../lib/supabase'
import { useAuth } from './AuthProvider'

type Mode = 'login' | 'signup' | 'forgot' | 'update'

export function AuthGate({ children }: PropsWithChildren) {
  const { ready, user } = useAuth()
  const reduce = useReducedMotion()
  const [mode, setMode] = useState<Mode>(() => window.location.hash.includes('type=recovery') ? 'update' : 'login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setMode('update')
    })
    return () => data.subscription.unsubscribe()
  }, [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true); setError(''); setNotice('')
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
      } else if (mode === 'signup') {
        if (password !== confirm) throw new Error('Passwords do not match')
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: window.location.origin } })
        if (error) throw error
        if (!data.session) setNotice('Check your email to verify your account, then return here to sign in.')
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/#type=recovery` })
        if (error) throw error
        setNotice('A password reset link has been sent if that account exists.')
      } else {
        if (password !== confirm) throw new Error('Passwords do not match')
        const { error } = await supabase.auth.updateUser({ password })
        if (error) throw error
        window.history.replaceState({}, '', window.location.pathname)
        setMode('login'); setNotice('Password updated. You can continue to the editor.')
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally { setBusy(false) }
  }

  const title = mode === 'signup' ? 'Create your account' : mode === 'forgot' ? 'Reset your password' : mode === 'update' ? 'Choose a new password' : 'Welcome back'
  const pageTransition = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : { initial: { opacity: 0, y: 12, filter: 'blur(3px)' }, animate: { opacity: 1, y: 0, filter: 'blur(0px)' }, exit: { opacity: 0, y: -8, filter: 'blur(2px)' } }
  const transition = { duration: 0.24, ease: 'easeOut' as const }
  let content: ReactNode

  if (!supabaseConfigured) {
    content = <motion.main key="auth-unconfigured" className="flex min-h-screen items-center justify-center bg-ink px-5 text-cream" transition={transition} {...pageTransition}><p className="max-w-lg rounded-md border border-line bg-panel p-5 text-sm">Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.</p></motion.main>
  } else if (!ready) {
    content = <motion.div key="auth-loading" className="h-full" transition={transition} {...pageTransition}><AuthLoading /></motion.div>
  } else if (user && mode !== 'update') {
    content = <motion.div key="workspace" className="h-full" transition={transition} {...pageTransition}>{children}</motion.div>
  } else {
    content = (
    <motion.main key={`auth-${mode}`} className="flex min-h-screen items-center justify-center bg-ink px-5 py-10 text-cream" transition={transition} {...pageTransition}>
      <section className="w-full max-w-sm rounded-xl border border-line bg-panel p-6 shadow-[var(--toast-shadow)]">
        <p className="text-[10px] font-semibold tracking-[.22em] text-mark uppercase">Parallax</p>
        <h1 className="mt-3 text-2xl font-medium">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-dim">Private AI-assisted video editing, backed by your verified account.</p>
        <form className="mt-6 space-y-4" onSubmit={submit}>
          {mode !== 'update' && <label className="block text-xs text-dim">Email<input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5 w-full rounded-md border border-line bg-ink px-3 py-2.5 text-sm text-cream outline-none focus:border-mark" /></label>}
          {mode !== 'forgot' && <label className="block text-xs text-dim">Password<div className="relative mt-1.5"><input required minLength={8} type={passwordVisible ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-md border border-line bg-ink px-3 py-2.5 pr-10 text-sm text-cream outline-none focus:border-mark" /><button type="button" onClick={() => setPasswordVisible((current) => !current)} className="absolute inset-y-0 right-0 grid w-10 place-items-center text-dim transition-colors hover:text-cream" aria-label={passwordVisible ? 'Hide password' : 'Show password'} title={passwordVisible ? 'Hide password' : 'Show password'}>{passwordVisible ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>}
          {(mode === 'signup' || mode === 'update') && <label className="block text-xs text-dim">Confirm password<input required minLength={8} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="mt-1.5 w-full rounded-md border border-line bg-ink px-3 py-2.5 text-sm text-cream outline-none focus:border-mark" /></label>}
          {error && <p role="alert" className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">{error}</p>}
          {notice && <p className="rounded-md border border-mark/30 bg-mark/10 px-3 py-2 text-xs leading-5 text-cream">{notice}</p>}
          <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-md bg-cream px-3 py-2.5 text-sm font-medium text-ink disabled:opacity-60">{busy && <Loader2 size={14} className="animate-spin" />}{mode === 'login' ? 'Sign in' : mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Send reset link' : 'Update password'}</button>
        </form>
        <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-xs text-dim">
          {mode !== 'login' && <button onClick={() => { setMode('login'); setError('') }} className="hover:text-cream">Back to sign in</button>}
          {mode === 'login' && <><button onClick={() => setMode('signup')} className="hover:text-cream">Create account</button><button onClick={() => setMode('forgot')} className="hover:text-cream">Forgot password?</button></>}
        </div>
      </section>
    </motion.main>
    )
  }

  return <AnimatePresence mode="wait">{content}</AnimatePresence>
}

function AuthLoading() {
  return <main className="flex min-h-screen items-center justify-center bg-ink text-dim"><Loader2 className="animate-spin" size={22} aria-label="Restoring session" /></main>
}
