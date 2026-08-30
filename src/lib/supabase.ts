import { createClient } from '@supabase/supabase-js'

const configuredURL = (import.meta.env.VITE_SUPABASE_URL ?? '').trim()
const configuredKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim()
export const supabaseConfigured = Boolean(configuredURL && configuredKey)
const url = configuredURL || 'http://127.0.0.1:54321'
const publishableKey = configuredKey || 'test-publishable-key'

export const supabase = createClient(url, publishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
