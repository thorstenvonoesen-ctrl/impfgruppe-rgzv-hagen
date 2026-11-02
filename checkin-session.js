import { makeCheckinUrl, parseCheckinToken } from './checkin-links.js'

// Retry only read-only previews. Never replay a payment or check-in mutation.
export async function previewCheckin({ auth, body, signal, fetchRequest = fetch, login = async token => {
  await auth.signOut({ scope: 'local' })
  window.location.replace(makeCheckinUrl(window.location.origin, token))
  window.location.reload()
} }) {
  const token = parseCheckinToken(body.token)
  if (!token || !['qr-preview', 'qr-resolve'].includes(body.action)) throw new Error('Ungültige Check-in-Vorschau.')
  const send = session => fetchRequest('/api/checkin', {
    method: 'POST', signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
    body: JSON.stringify({ ...body, token })
  })
  const { data: { session } } = await auth.getSession()
  let response = session ? await send(session) : null
  if (!response || response.status === 401) {
    const refreshed = await auth.refreshSession()
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    if (!refreshed.error && refreshed.data?.session) response = await send(refreshed.data.session)
    if (!response || response.status === 401) {
      await login(token)
      throw new Error('Bitte erneut anmelden. Der gescannte Teilnehmer bleibt für den Login erhalten.')
    }
  }
  return response
}
