import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

export const supabaseConfigMessage = 'Die Datenbankverbindung ist noch nicht vollständig konfiguriert.'
export const hasSupabase = Boolean(url && anonKey)

function unavailableResult() {
  return { data: null, error: new Error(supabaseConfigMessage) }
}

function unavailableQuery() {
  const result = unavailableResult()
  let query
  query = new Proxy({}, {
    get(_, property) {
      if (property === 'then') return (resolve, reject) => Promise.resolve(result).then(resolve, reject)
      if (property === 'catch') return reject => Promise.resolve(result).catch(reject)
      if (property === 'finally') return callback => Promise.resolve(result).finally(callback)
      return () => query
    }
  })
  return query
}

const unavailableClient = {
  from: () => unavailableQuery(),
  auth: {
    getSession: async () => ({ data: { session: null }, error: new Error(supabaseConfigMessage) }),
    signInWithPassword: async () => ({ data: { session: null }, error: new Error(supabaseConfigMessage) }),
    signOut: async () => unavailableResult()
  }
}

// No client is initialized until both public frontend values are configured.
export const supabase = hasSupabase ? createClient(url, anonKey) : unavailableClient
