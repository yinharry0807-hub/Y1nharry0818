const BASE = (Deno.env.get("DEEPSEEK_BASE_URL") || "https://api.deepseek.com").replace(/\/+$/, "")
const KEY = Deno.env.get("DEEPSEEK_API_KEY") || ""
const MODELS = (Deno.env.get("DEEPSEEK_MODELS") || "deepseek-v4-pro,deepseek-v4-flash")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)
const DEFAULT_MODEL = Deno.env.get("DEEPSEEK_DEFAULT_MODEL") || MODELS[0] || "deepseek-v4-pro"

export const getModels = () => MODELS
export const getDefaultModel = () => DEFAULT_MODEL
export const isDeepSeekConfigured = () => Boolean(KEY)

function resolveModel(model: string | undefined): string {
  if (model && MODELS.includes(model)) return model
  return DEFAULT_MODEL
}

function isModelError(data: any): boolean {
  return Boolean(data && data.error && /model|not exist|invalid/i.test(data.error.message || ""))
}

async function request(url: string, options: RequestInit): Promise<any> {
  const resp = await fetch(url, options)
  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}))
    return { ok: false, status: resp.status, data }
  }
  return { ok: true, status: resp.status, resp }
}

async function doStream(
  model: string,
  messages: any[],
  onDelta?: (d: string) => void
): Promise<any> {
  let result
  try {
    result = await request(`${BASE}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
      body: JSON.stringify({ model, messages, stream: true, max_tokens: 8000 })
    })
  } catch (e) {
    return { ok: false, status: 0, data: { error: { message: (e as Error).message } }, model }
  }
  if (!result.ok) return { ok: false, status: result.status, data: result.data, model }

  const reader = result.resp.body.getReader()
  const decoder = new TextDecoder()
  let buf = ""
  let content = ""
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      const lines = buf.split("\n")
      buf = lines.pop() as string
      for (const line of lines) {
        const t = line.trim()
        if (!t.startsWith("data:")) continue
        const payload = t.slice(5).trim()
        if (!payload || payload === "[DONE]") continue
        try {
          const j = JSON.parse(payload)
          const delta = j.choices?.[0]?.delta?.content
          if (delta) {
            content += delta
            if (onDelta) onDelta(delta)
          }
        } catch {
          // 忽略无法解析的分片
        }
      }
    }
  } catch (e) {
    return { ok: false, status: 0, data: { error: { message: (e as Error).message } }, model }
  }
  return { ok: true, content, model }
}

export async function chatStream(opts: {
  model?: string
  messages: any[]
  onDelta?: (d: string) => void
}): Promise<any> {
  const first = resolveModel(opts.model)
  const attempt = await doStream(first, opts.messages, opts.onDelta)
  if (!attempt.ok && attempt.status === 400 && isModelError(attempt.data) && first !== DEFAULT_MODEL) {
    const second = await doStream(DEFAULT_MODEL, opts.messages, opts.onDelta)
    if (second.ok) return { ...second, usedFallback: true, fallbackModel: DEFAULT_MODEL }
    return second
  }
  return attempt
}

async function doJSON(model: string, messages: any[]): Promise<any> {
  const body = {
    model,
    messages,
    stream: false,
    max_tokens: 8000,
    response_format: { type: "json_object" }
  }
  let result
  try {
    result = await request(`${BASE}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
      body: JSON.stringify(body)
    })
  } catch (e) {
    return { ok: false, status: 0, data: { error: { message: (e as Error).message } }, model }
  }
  if (!result.ok) {
    const msg = (result.data && result.data.error && result.data.error.message) || ""
    if (result.status === 400 && /response_format|json_object/i.test(msg)) {
      try {
        const retry = await request(`${BASE}/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
          body: JSON.stringify({ model, messages, stream: false, max_tokens: 8000 })
        })
        if (!retry.ok) return { ok: false, status: retry.status, data: retry.data, model }
        const j = await retry.resp.json()
        const text = j.choices?.[0]?.message?.content || ""
        return { ok: true, content: extractJSON(text), raw: text, model }
      } catch (e) {
        return { ok: false, status: 0, data: { error: { message: (e as Error).message } }, model }
      }
    }
    return { ok: false, status: result.status, data: result.data, model }
  }
  const j = await result.resp.json()
  const text = j.choices?.[0]?.message?.content || ""
  return { ok: true, content: extractJSON(text), raw: text, model }
}

export async function chatJSON(opts: { model?: string; messages: any[] }): Promise<any> {
  const first = resolveModel(opts.model)
  let result = await doJSON(first, opts.messages)
  if (!result.ok && result.status === 400 && isModelError(result.data) && first !== DEFAULT_MODEL) {
    result = await doJSON(DEFAULT_MODEL, opts.messages)
    if (result.ok) result.usedFallback = true
  }
  return result
}

export function extractJSON(text: string): any {
  if (!text) return null
  const t = text.trim()
  try {
    return JSON.parse(t)
  } catch {
    // 继续尝试其他格式
  }
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) {
    try {
      return JSON.parse(fenced[1].trim())
    } catch {
      // 继续
    }
  }
  const start = t.indexOf("{")
  const end = t.lastIndexOf("}")
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(t.slice(start, end + 1))
    } catch {
      // 放弃
    }
  }
  return null
}
