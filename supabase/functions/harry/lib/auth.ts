import { json } from "./http.ts"

const APP_PASSWORD = Deno.env.get("APP_PASSWORD") || ""
let secretCache: string | null = null

function bytesToB64url(bytes: Uint8Array): string {
  let bin = ""
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

async function getSecret(): Promise<string> {
  if (secretCache) return secretCache
  const fromEnv = Deno.env.get("JWT_SECRET")
  if (fromEnv) {
    secretCache = fromEnv
    return secretCache
  }
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode("harry-advisor:" + APP_PASSWORD)
  )
  secretCache = bytesToB64url(new Uint8Array(digest))
  return secretCache
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
}

export async function signToken(): Promise<string> {
  const secret = await getSecret()
  const key = await hmacKey(secret)
  const payload = btoa(JSON.stringify({ exp: Date.now() + 30 * 24 * 3600 * 1000 }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
  const sig = bytesToB64url(
    new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)))
  )
  return `${payload}.${sig}`
}

export async function verifyToken(token: string): Promise<boolean> {
  if (!token) return false
  const parts = token.split(".")
  if (parts.length !== 2) return false
  const [payload, sig] = parts
  const secret = await getSecret()
  const key = await hmacKey(secret)
  const expected = bytesToB64url(
    new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)))
  )
  if (expected !== sig) return false
  try {
    const b64 = payload.replace(/-/g, "+").replace(/_/g, "/")
    const bin = atob(b64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    const data = JSON.parse(new TextDecoder().decode(bytes)) as { exp?: number }
    return typeof data.exp === "number" && Date.now() < data.exp
  } catch {
    return false
  }
}

export async function requireAuth(
  req: Request
): Promise<{ ok: true } | { ok: false; response: Response }> {
  if (!APP_PASSWORD) {
    return {
      ok: false,
      response: json({ error: "服务端未设置 APP_PASSWORD，请先在密钥中配置" }, 500)
    }
  }
  const header = req.headers.get("authorization") || ""
  const token = header.startsWith("Bearer ") ? header.slice(7) : ""
  if (!(await verifyToken(token))) {
    return {
      ok: false,
      response: json({ error: "未登录或登录已过期，请重新登录" }, 401)
    }
  }
  return { ok: true }
}
