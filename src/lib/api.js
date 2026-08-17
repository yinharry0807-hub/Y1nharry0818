const TOKEN_KEY = 'harry_token'

const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '')
const fullUrl = (path) => API_BASE + path

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || ''
  } catch {
    return ''
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // ignore
  }
}

export async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(fullUrl(path), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || `请求失败（${res.status}）`)
  }
  return data
}

export async function streamChat(payload, handlers = {}) {
  const headers = { 'Content-Type': 'application/json' }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(fullUrl('/api/chat'), {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || `请求失败（${res.status}）`)
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  let done = false
  while (!done) {
    const { value, done: d } = await reader.read()
    done = d
    if (value) {
      buf += decoder.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop()
      for (const line of lines) {
        const t = line.trim()
        if (!t.startsWith('data:')) continue
        const raw = t.slice(5).trim()
        if (!raw) continue
        let obj
        try {
          obj = JSON.parse(raw)
        } catch {
          continue
        }
        if (obj.type === 'meta' && handlers.onMeta) handlers.onMeta(obj.conversationId)
        else if (obj.type === 'delta' && handlers.onDelta) handlers.onDelta(obj.content || '')
        else if (obj.type === 'done' && handlers.onDone) handlers.onDone(obj)
        else if (obj.type === 'error' && handlers.onError) handlers.onError(obj.message || 'AI 服务出错')
      }
    }
  }
}
