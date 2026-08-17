import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2"
import { getProfileSeed } from "./seed.ts"

const supabaseUrl = Deno.env.get("SUPABASE_URL") || ""
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
const useSupabase = Boolean(supabaseUrl && supabaseKey)

let supabase: SupabaseClient | null = null
if (useSupabase) {
  supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })
}

export const isSupabase = useSupabase
export const storageMode = useSupabase ? "supabase" : "local"

const DATA_DIR = Deno.env.get("DATA_DIR") || (Deno.cwd() + "/.data")

function jstore(table: string) {
  const file = `${DATA_DIR}/${table}.json`
  const read = (): any[] => {
    try {
      const raw = Deno.readTextFileSync(file)
      const rows = JSON.parse(raw)
      return Array.isArray(rows) ? rows : []
    } catch {
      return []
    }
  }
  const write = (rows: any[]) => {
    Deno.mkdirSync(DATA_DIR, { recursive: true })
    Deno.writeTextFileSync(file, JSON.stringify(rows, null, 2))
  }
  return { read, write }
}

function nextSeq(rows: any[]): number {
  return rows.reduce((m, r) => Math.max(m, Number(r.seq) || 0), 0) + 1
}

function nowIso(): string {
  return new Date().toISOString()
}

export async function listRows(
  table: string,
  orderBy = "created_at",
  orderDir: "asc" | "desc" = "desc",
  limit = 500
): Promise<any[]> {
  if (useSupabase && supabase) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order(orderBy, { ascending: orderDir === "asc" })
      .limit(limit)
    if (error) throw new Error(error.message)
    return (data as any[]) || []
  }
  const rows = jstore(table).read()
  rows.sort((a: any, b: any) => {
    const av = a[orderBy]
    const bv = b[orderBy]
    if (av === bv) return 0
    if (orderDir === "asc") return av > bv ? 1 : -1
    return av < bv ? 1 : -1
  })
  return rows.slice(0, limit)
}

export async function getRow(table: string, id: string | number): Promise<any | null> {
  if (useSupabase && supabase) {
    const { data, error } = await supabase.from(table).select("*").eq("id", id).maybeSingle()
    if (error) throw new Error(error.message)
    return data
  }
  return jstore(table).read().find((r) => String(r.id) === String(id)) || null
}

export async function insertRow(table: string, row: Record<string, unknown>): Promise<any> {
  const data: Record<string, unknown> = { ...row, created_at: (row.created_at as string) || nowIso() }
  if (useSupabase && supabase) {
    const { data: inserted, error } = await supabase.from(table).insert(data).select().single()
    if (error) throw new Error(error.message)
    return inserted
  }
  const store = jstore(table)
  const rows = store.read()
  const id = (data.id as string) || crypto.randomUUID()
  const item: Record<string, unknown> = { ...data, id }
  if (table === "messages") item.seq = nextSeq(rows)
  rows.push(item)
  store.write(rows)
  return item
}

export async function updateRow(
  table: string,
  id: string | number,
  patch: Record<string, unknown>
): Promise<any> {
  if (useSupabase && supabase) {
    const { data, error } = await supabase
      .from(table)
      .update({ ...patch, updated_at: (patch.updated_at as string) || nowIso() })
      .eq("id", id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data
  }
  const store = jstore(table)
  const rows = store.read()
  const idx = rows.findIndex((r) => String(r.id) === String(id))
  if (idx === -1) return null
  rows[idx] = { ...rows[idx], ...patch, updated_at: (patch.updated_at as string) || nowIso() }
  store.write(rows)
  return rows[idx]
}

export async function deleteRow(table: string, id: string): Promise<boolean> {
  if (useSupabase && supabase) {
    const { error } = await supabase.from(table).delete().eq("id", id)
    if (error) throw new Error(error.message)
    return true
  }
  const store = jstore(table)
  store.write(store.read().filter((r) => String(r.id) !== String(id)))
  return true
}

export async function getMessages(conversationId: string, limit = 500): Promise<any[]> {
  if (useSupabase && supabase) {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(limit)
    if (error) throw new Error(error.message)
    return (data as any[]) || []
  }
  return jstore("messages")
    .read()
    .filter((r) => String(r.conversation_id) === String(conversationId))
    .sort((a: any, b: any) => (Number(a.seq) || 0) - (Number(b.seq) || 0))
    .slice(-limit)
}

export async function deleteConversation(id: string): Promise<boolean> {
  if (useSupabase && supabase) {
    const { error } = await supabase.from("conversations").delete().eq("id", id)
    if (error) throw new Error(error.message)
    return true
  }
  const convs = jstore("conversations")
  const msgs = jstore("messages")
  convs.write(convs.read().filter((r) => String(r.id) !== String(id)))
  msgs.write(msgs.read().filter((r) => String(r.conversation_id) !== String(id)))
  return true
}

export async function getProfileRow(): Promise<any> {
  let profile = await getRow("user_profile", 1)
  if (!profile) {
    profile = await insertRow("user_profile", {
      id: 1,
      base_text: getProfileSeed(),
      updates: [],
      latest_summary: "",
      updated_at: nowIso()
    })
  }
  return profile
}
