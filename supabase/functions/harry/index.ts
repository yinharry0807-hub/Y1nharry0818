import { CORS, json, notFound, methodNotAllowed } from "./lib/http.ts"
import { requireAuth, signToken } from "./lib/auth.ts"
import {
  deleteConversation,
  deleteRow,
  getMessages,
  getProfileRow,
  getRow,
  insertRow,
  isSupabase,
  listRows,
  storageMode,
  updateRow
} from "./lib/db.ts"
import {
  chatJSON,
  chatStream,
  getDefaultModel,
  getModels,
  isDeepSeekConfigured
} from "./lib/deepseek.ts"
import { buildSystemPrompt, recentHistory } from "./lib/context.ts"
import {
  knowledgeClassifyPrompt,
  newsGeneratePrompt,
  profileUpdatePrompt,
  resumeGeneratePrompt
} from "./lib/prompts.ts"

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

// ==================== 认证 ====================

async function handleLogin(req: Request): Promise<Response> {
  const body = await req.json().catch(() => ({}))
  const password = String((body as any).password || "")
  if (!Deno.env.get("APP_PASSWORD")) {
    return json({ error: "服务端未配置 APP_PASSWORD，请先在密钥中配置" }, 500)
  }
  if (password === Deno.env.get("APP_PASSWORD")) {
    return json({ token: await signToken(), message: "ok" })
  }
  return json({ error: "密码错误" }, 401)
}

async function handleStatus(req: Request): Promise<Response> {
  const auth = await requireAuth(req)
  if (!auth.ok) return auth.response
  return json({ ok: true })
}

async function handleConfig(req: Request): Promise<Response> {
  const auth = await requireAuth(req)
  if (!auth.ok) return auth.response
  return json({
    models: getModels(),
    defaultModel: getDefaultModel(),
    deepseekConfigured: isDeepSeekConfigured(),
    storageMode,
    supabaseConfigured: isSupabase
  })
}

// ==================== 对话 ====================

async function handleChat(req: Request): Promise<Response> {
  const auth = await requireAuth(req)
  if (!auth.ok) return auth.response
  const body = await req.json().catch(() => ({}))
  const message = String((body as any).message || "").trim()
  const model = (body as any).model as string | undefined
  const conversationId = (body as any).conversationId as string | null | undefined
  if (!message) return json({ error: "消息不能为空" }, 400)

  try {
    let convId = conversationId || null
    if (!convId) {
      const conv = await insertRow("conversations", {
        title: message.slice(0, 24),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      convId = conv.id as string
    }
    await insertRow("messages", {
      conversation_id: convId,
      role: "user",
      content: message,
      model: null,
      created_at: new Date().toISOString()
    })
    await updateRow("conversations", convId, { updated_at: new Date().toISOString() })

    const profile = await getProfileRow()
    const allKnowledge = await listRows("knowledge_base", "created_at", "desc", 500)
    const knowledge = allKnowledge
      .filter((k) => k.category === "当前阶段有用")
      .slice(0, 10)
    const history = await getMessages(convId, 500)
    const messages = [
      { role: "system", content: buildSystemPrompt(profile, knowledge) },
      ...recentHistory(history)
    ]

    const encoder = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (obj: unknown) =>
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))
        send({ type: "meta", conversationId: convId })
        let acc = ""
        const result = await chatStream({
          model,
          messages,
          onDelta: (d) => {
            acc += d
            send({ type: "delta", content: d })
          }
        })
        if (result.ok) {
          let content = result.content || ""
          if (result.usedFallback) {
            content = `（注：所选模型不可用，已自动切换为 ${result.fallbackModel}）\n\n${content}`
          }
          await insertRow("messages", {
            conversation_id: convId,
            role: "assistant",
            content,
            model: result.model || model || null,
            created_at: new Date().toISOString()
          })
          send({ type: "done", content, usedFallback: Boolean(result.usedFallback) })
        } else {
          const msg = (result.data && result.data.error && result.data.error.message) ||
            "AI 服务调用失败"
          send({ type: "error", message: msg, status: result.status })
        }
        controller.close()
      }
    })
    return new Response(stream, {
      status: 200,
      headers: {
        ...CORS,
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform"
      }
    })
  } catch (e) {
    return json({ error: errMessage(e) }, 500)
  }
}

// ==================== 档案 ====================

async function handleProfileGet(req: Request): Promise<Response> {
  const auth = await requireAuth(req)
  if (!auth.ok) return auth.response
  const profile = await getProfileRow()
  return json({ profile })
}

async function handleProfileUpdate(req: Request): Promise<Response> {
  const auth = await requireAuth(req)
  if (!auth.ok) return auth.response
  const body = await req.json().catch(() => ({}))
  const text = String((body as any).text || "").trim()
  if (!text) return json({ error: "近况内容不能为空" }, 400)

  const profile = await getProfileRow()
  let summary = text.slice(0, 120)
  let tags = ["近况"]
  let usedFallback = false

  if (isDeepSeekConfigured()) {
    const result = await chatJSON({
      messages: [{ role: "user", content: profileUpdatePrompt(text) }]
    })
    if (result.ok && result.content) {
      if (result.content.summary) summary = result.content.summary
      if (Array.isArray(result.content.tags)) tags = result.content.tags
      usedFallback = Boolean(result.usedFallback)
    }
  }

  const updates = Array.isArray(profile.updates) ? profile.updates : []
  updates.push({
    date: new Date().toISOString().slice(0, 10),
    text,
    summary,
    tags
  })
  const updated = await updateRow("user_profile", 1, {
    updates,
    latest_summary: summary,
    updated_at: new Date().toISOString()
  })
  return json({ profile: updated, extracted: { summary, tags }, usedFallback })
}

// ==================== 对话列表 ====================

async function handleConversationsList(req: Request): Promise<Response> {
  const auth = await requireAuth(req)
  if (!auth.ok) return auth.response
  const conversations = await listRows("conversations", "updated_at", "desc", 200)
  return json({ conversations })
}

async function handleConversationMessages(req: Request, id: string): Promise<Response> {
  const auth = await requireAuth(req)
  if (!auth.ok) return auth.response
  const messages = await getMessages(id)
  return json({ messages })
}

async function handleConversationDelete(req: Request, id: string): Promise<Response> {
  const auth = await requireAuth(req)
  if (!auth.ok) return auth.response
  await deleteConversation(id)
  return json({ ok: true })
}

// ==================== 知识库 ====================

async function handleKnowledgeList(req: Request): Promise<Response> {
  const auth = await requireAuth(req)
  if (!auth.ok) return auth.response
  const items = await listRows("knowledge_base", "created_at", "desc", 500)
  return json({ items })
}

async function handleKnowledgeAdd(req: Request): Promise<Response> {
  const auth = await requireAuth(req)
  if (!auth.ok) return auth.response
  const body = await req.json().catch(() => ({}))
  const content = String((body as any).content || "").trim()
  if (!content) return json({ error: "内容不能为空" }, 400)

  let category = "当前阶段有用"
  let title = content.slice(0, 20)
  let summary = content.slice(0, 150)
  let reason = "未启用 AI 分类（未配置 DEEPSEEK_API_KEY），默认归入当前阶段有用"
  let usedFallback = false

  if (isDeepSeekConfigured()) {
    const result = await chatJSON({
      messages: [{ role: "user", content: knowledgeClassifyPrompt(content) }]
    })
    if (result.ok && result.content) {
      const c = result.content
      if (["当前阶段有用", "未来有用", "有误导性"].includes(c.category)) category = c.category
      if (c.title) title = c.title
      if (c.summary) summary = c.summary
      if (c.reason) reason = c.reason
      usedFallback = Boolean(result.usedFallback)
    }
  }
  const item = await insertRow("knowledge_base", {
    category,
    title,
    summary,
    reason,
    original_content: content,
    created_at: new Date().toISOString()
  })
  return json({ item, usedFallback })
}

async function handleKnowledgeDelete(req: Request, id: string): Promise<Response> {
  const auth = await requireAuth(req)
  if (!auth.ok) return auth.response
  await deleteRow("knowledge_base", id)
  return json({ ok: true })
}

// ==================== 简历 ====================

async function handleResumesList(req: Request): Promise<Response> {
  const auth = await requireAuth(req)
  if (!auth.ok) return auth.response
  const versions = await listRows("resume_versions", "updated_at", "desc", 100)
  return json({ versions })
}

async function handleResumesCreate(req: Request): Promise<Response> {
  const auth = await requireAuth(req)
  if (!auth.ok) return auth.response
  const body = await req.json().catch(() => ({}))
  const name = String((body as any).name || "").trim()
  const targetRole = String((body as any).targetRole || "").trim()
  const content = String((body as any).content || "").trim()
  if (!content) return json({ error: "简历内容不能为空" }, 400)
  const version = await insertRow("resume_versions", {
    name: name || "未命名版本",
    target_role: targetRole,
    content,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  })
  return json({ version })
}

async function handleResumesGenerate(req: Request): Promise<Response> {
  const auth = await requireAuth(req)
  if (!auth.ok) return auth.response
  if (!isDeepSeekConfigured()) {
    return json({ error: "未配置 DEEPSEEK_API_KEY，无法生成简历" }, 500)
  }
  const body = await req.json().catch(() => ({}))
  const targetRole = String((body as any).targetRole || "supply")
  const raw = String((body as any).raw || "").trim()
  const profile = await getProfileRow()
  const result = await chatJSON({
    messages: [
      {
        role: "user",
        content: resumeGeneratePrompt(targetRole, raw, profile.base_text || "")
      }
    ]
  })
  if (!result.ok) {
    const msg = (result.data && result.data.error && result.data.error.message) || "生成失败"
    return json({ error: msg }, 500)
  }
  if (!result.content) {
    return json({ error: "AI 返回格式无法解析，请重试" }, 500)
  }
  return json({
    draft: result.content,
    markdown: draftToMarkdown(result.content),
    usedFallback: Boolean(result.usedFallback)
  })
}

function draftToMarkdown(d: any): string {
  const lines: string[] = []
  lines.push("# 个人总结")
  lines.push(d.summary || "")
  lines.push("")
  lines.push("# 工作经历")
  const exps = Array.isArray(d.experience) ? d.experience : []
  if (!exps.length) lines.push("（暂无）")
  for (const exp of exps) {
    const head = [exp.company, exp.position].filter(Boolean).join(" · ")
    if (head) lines.push(`## ${head}`)
    if (exp.period) lines.push(`（${exp.period}）`)
    for (const b of exp.bullets || []) lines.push(`- ${b}`)
    lines.push("")
  }
  lines.push("# 技能")
  lines.push((d.skills || []).join("、"))
  lines.push("")
  lines.push("# 关键词")
  lines.push((d.keywords || []).join("、"))
  return lines.join("\n").trim()
}

async function handleResumesUpdate(req: Request, id: string): Promise<Response> {
  const auth = await requireAuth(req)
  if (!auth.ok) return auth.response
  const body = await req.json().catch(() => ({}))
  const patch: Record<string, unknown> = {}
  if (typeof (body as any).name === "string") {
    patch.name = ((body as any).name as string).trim() || "未命名版本"
  }
  if (typeof (body as any).targetRole === "string") {
    patch.target_role = ((body as any).targetRole as string).trim()
  }
  if (typeof (body as any).content === "string") {
    patch.content = (body as any).content
  }
  patch.updated_at = new Date().toISOString()
  const version = await updateRow("resume_versions", id, patch)
  return json({ version })
}

async function handleResumesDelete(req: Request, id: string): Promise<Response> {
  const auth = await requireAuth(req)
  if (!auth.ok) return auth.response
  await deleteRow("resume_versions", id)
  return json({ ok: true })
}

// ==================== 资讯 ====================

async function handleNewsList(req: Request): Promise<Response> {
  const auth = await requireAuth(req)
  if (!auth.ok) return auth.response
  const digests = await listRows("news_digest", "created_at", "desc", 50)
  return json({ digests })
}

async function handleNewsGenerate(req: Request): Promise<Response> {
  const auth = await requireAuth(req)
  if (!auth.ok) return auth.response
  if (!isDeepSeekConfigured()) {
    return json({ error: "未配置 DEEPSEEK_API_KEY，无法生成资讯" }, 500)
  }
  const body = await req.json().catch(() => ({}))
  const mode = (body as any).mode === "daily" ? "daily" : "weekly"

  let items: any[] = []
  let usedFallback = false
  let lastError = ""
  for (let attempt = 0; attempt < 2 && !items.length; attempt += 1) {
    const result = await chatJSON({
      messages: [
        {
          role: "user",
          content:
            newsGeneratePrompt(mode) +
            (attempt === 0
              ? ""
              : "\n\n注意：上一次生成被截断。这次请直接输出完整 JSON，不要省略任何条目，不要在任何 item 中间截断。")
        }
      ]
    })
    if (!result.ok) {
      lastError = (result.data && result.data.error && result.data.error.message) || "生成失败"
      break
    }
    usedFallback = usedFallback || Boolean(result.usedFallback)
    items = Array.isArray(result.content && result.content.items) ? result.content.items : []
    if (!items.length) lastError = "AI 返回格式无法解析，请重试"
  }
  if (!items.length) return json({ error: lastError || "生成失败" }, 500)

  const digest = await insertRow("news_digest", {
    mode,
    items,
    created_at: new Date().toISOString()
  })
  return json({ digest, usedFallback })
}

async function handleNewsDelete(req: Request, id: string): Promise<Response> {
  const auth = await requireAuth(req)
  if (!auth.ok) return auth.response
  await deleteRow("news_digest", id)
  return json({ ok: true })
}

// ==================== 路由 ====================

async function route(seg: string[], req: Request): Promise<Response> {
  const m = req.method
  if (seg.length === 0) return notFound()
  switch (seg[0]) {
    case "auth":
      if (seg[1] === "login" && m === "POST") return handleLogin(req)
      if (seg[1] === "status" && m === "GET") return handleStatus(req)
      break
    case "config":
      if (m === "GET") return handleConfig(req)
      break
    case "chat":
      if (m === "POST") return handleChat(req)
      break
    case "profile":
      if (seg.length === 1 && m === "GET") return handleProfileGet(req)
      if (seg[1] === "update" && m === "POST") return handleProfileUpdate(req)
      break
    case "conversations":
      if (seg.length === 1 && m === "GET") return handleConversationsList(req)
      if (seg.length === 2 && m === "GET") return handleConversationMessages(req, seg[1])
      if (seg.length === 2 && m === "DELETE") return handleConversationDelete(req, seg[1])
      break
    case "knowledge":
      if (seg.length === 1 && m === "GET") return handleKnowledgeList(req)
      if (seg.length === 1 && m === "POST") return handleKnowledgeAdd(req)
      if (seg.length === 2 && m === "DELETE") return handleKnowledgeDelete(req, seg[1])
      break
    case "resumes":
      if (seg.length === 1 && m === "GET") return handleResumesList(req)
      if (seg.length === 1 && m === "POST") return handleResumesCreate(req)
      if (seg[1] === "generate" && m === "POST") return handleResumesGenerate(req)
      if (seg.length === 2 && m === "PUT") return handleResumesUpdate(req, seg[1])
      if (seg.length === 2 && m === "DELETE") return handleResumesDelete(req, seg[1])
      break
    case "news":
      if (seg.length === 1 && m === "GET") return handleNewsList(req)
      if (seg[1] === "generate" && m === "POST") return handleNewsGenerate(req)
      if (seg.length === 2 && m === "DELETE") return handleNewsDelete(req, seg[1])
      break
  }
  return methodNotAllowed()
}

function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return Promise.resolve(new Response(null, { status: 204, headers: CORS }))
  }
  const url = new URL(req.url)
  const path = url.pathname.replace(/^\/functions\/v1\/[^/]+/, "")
  const seg = path.split("/").filter(Boolean)
  const api = seg[0] === "api" ? seg.slice(1) : seg
  try {
    return route(api, req)
  } catch (e) {
    return Promise.resolve(json({ error: errMessage(e) }, 500))
  }
}

const port = Number(Deno.env.get("PORT") || 8787)
Deno.serve({ port }, handler)
