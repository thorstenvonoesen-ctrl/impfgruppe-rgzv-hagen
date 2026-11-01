// Shared by the authenticated scanner and the server. Never navigates to a scan URL.
const tokenPattern=/^(?:[a-f0-9]{64}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i
export function parseCheckinToken(value) {
  const text=String(value||'').trim()
  if(tokenPattern.test(text))return text
  try {
    const url=new URL(text)
    if(url.protocol!=='https:' && !(url.protocol==='http:'&&url.hostname==='localhost'))return null
    const token=new URLSearchParams(url.hash.slice(1)).get('checkin')
    return tokenPattern.test(token||'')?token:null
  }catch{return null}
}
export function makeCheckinUrl(baseUrl,token) {
  if(!tokenPattern.test(String(token||'')))throw Object.assign(new Error('Check-in-Token fehlt oder ist ungültig.'),{code:'CHECKIN_TOKEN_INVALID'})
  const url=new URL(baseUrl)
  if(url.protocol!=='https:'&&!(url.protocol==='http:'&&url.hostname==='localhost'))throw new Error('Ungültige Check-in-Adresse.')
  return `${url.origin}/#checkin=${encodeURIComponent(token)}`
}
