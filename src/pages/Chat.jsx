import { useEffect, useRef, useState } from 'react'
import { api, streamChat } from '../lib/api.js'
import {
  ChatIcon,
  MenuIcon,
  PlusIcon,
  SendIcon,
  TrashIcon,
  CopyIcon,
  SettingsIcon
} from '../lib/icons.jsx'

const SUGGESTIONS = [
  '帮我评估一下现在跳槽的时机和风险',
  '我现在很焦虑，帮我拆解一下',
  '今天我可以做的最小一步是什么？',
  '记录近况：今天加班到10点，心态有点崩'
]

export default function Chat({ config, onToast, onOpenSettings }) {
  const [conversations, setConversations] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [drawer, setDrawer] = useState(false)
  const [streamError, setStreamError] = useState(null)
  const [model, setModel] = useState(
    () => localStorage.getItem('harry_model') || config?.defaultModel || 'deepseek-chat'
  )
  const scrollRef = useRef(null)

  const loadConversations = async () => {
    try {
      const d = await api('/api/conversations')
      setConversations(d.conversations)
    } catch (e) {
      onToast(e.message)
    }
  }

  const loadMessages = async (id) => {
    try {
      const d = await api(`/api/conversations/${id}`)
      setMessages(d.messages)
      setActiveId(id)
      setStreamError(null)
    } catch (e) {
      onToast(e.message)
    }
  }

  useEffect(() => {
    loadConversations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, sending])

  const newChat = () => {
    setActiveId(null)
    setMessages([])
    setStreamError(null)
    setDrawer(false)
  }

  const deleteConversation = async (e, id) => {
    e.stopPropagation()
    if (!window.confirm('删除这段对话？不可恢复。')) return
    try {
      await api(`/api/conversations/${id}`, { method: 'DELETE' })
      if (activeId === id) newChat()
      loadConversations()
    } catch (err) {
      onToast(err.message)
    }
  }

  const send = async () => {
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    setStreamError(null)
    const userTmp = 'u' + Date.now()
    const aiTmp = 'a' + Date.now()
    setMessages((m) => [
      ...m,
      { id: userTmp, role: 'user', content: text },
      { id: aiTmp, role: 'assistant', content: '', streaming: true }
    ])
    setSending(true)
    let acc = ''
    let convId = activeId
    try {
      await streamChat(
        { conversationId: convId, message: text, model },
        {
          onMeta: (id) => {
            convId = id
            setActiveId(id)
          },
          onDelta: (d) => {
            acc += d
            setMessages((m) => m.map((x) => (x.id === aiTmp ? { ...x, content: acc } : x)))
          },
          onDone: (payload) => {
            const final = payload.content || acc
            setMessages((m) =>
              m.map((x) => (x.id === aiTmp ? { ...x, content: final, streaming: false } : x))
            )
            setActiveId(convId)
            loadConversations()
          },
          onError: (msg) => {
            setStreamError(msg)
            setMessages((m) =>
              m.map((x) =>
                x.id === aiTmp ? { ...x, content: acc || '', streaming: false, failed: true } : x
              )
            )
          }
        }
      )
    } catch (e) {
      setStreamError(e.message)
      setMessages((m) =>
        m.map((x) =>
          x.id === aiTmp ? { ...x, content: acc || '', streaming: false, failed: true } : x
        )
      )
    } finally {
      setSending(false)
    }
  }

  const pickModel = (m) => {
    setModel(m)
    localStorage.setItem('harry_model', m)
  }

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      onToast('已复制')
    } catch {
      onToast('复制失败')
    }
  }

  const fmtTime = (iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const hh = String(d.getHours()).padStart(2, '0')
    const mi = String(d.getMinutes()).padStart(2, '0')
    return `${mm}-${dd} ${hh}:${mi}`
  }

  return (
    <div className="chat-page">
      {drawer && <div className="chat-backdrop" onClick={() => setDrawer(false)} />}
      <aside className={`chat-list ${drawer ? 'open' : ''}`}>
        <div className="chat-list-head">
          <button className="btn btn-primary btn-sm" onClick={newChat}>
            <PlusIcon size={15} /> 新对话
          </button>
        </div>
        <div className="chat-list-body">
          {conversations.length === 0 && (
            <div className="faint" style={{ padding: '10px' }}>
              还没有对话
            </div>
          )}
          {conversations.map((c) => (
            <div
              key={c.id}
              className={`chat-item ${activeId === c.id ? 'active' : ''}`}
              onClick={() => {
                loadMessages(c.id)
                setDrawer(false)
              }}
            >
              <ChatIcon size={15} />
              <span className="t">{c.title || '新对话'}</span>
              <span className="d">{fmtTime(c.updated_at)}</span>
              <button
                className="msg-copy"
                title="删除对话"
                onClick={(e) => deleteConversation(e, c.id)}
              >
                <TrashIcon size={14} />
              </button>
            </div>
          ))}
        </div>
      </aside>

      <div className="chat-main">
        <div className="chat-topbar">
          <button className="btn btn-ghost btn-sm mobile-only" onClick={() => setDrawer(true)}>
            <MenuIcon size={18} />
          </button>
          <h1>对话</h1>
          <div className="spacer" />
          <span className="faint hide-mobile">模型</span>
          <select
            className="model-select"
            value={model}
            onChange={(e) => pickModel(e.target.value)}
          >
            {(config?.models || ['deepseek-chat']).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <button className="btn btn-ghost btn-sm mobile-only" onClick={onOpenSettings}>
            <SettingsIcon size={17} />
          </button>
        </div>

        <div className="chat-scroll" ref={scrollRef}>
          {messages.length === 0 && (
            <div className="chat-empty">
              <div className="logo-mark" style={{ width: 54, height: 54, fontSize: 26 }}>
                H
              </div>
              <div style={{ fontSize: 17, color: 'var(--text)' }}>Harry · 你的终身专属顾问</div>
              <div>直接说你的近况、困惑或决策问题。想怎么开始？</div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  width: 'min(460px, 92%)'
                }}
              >
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    className="chip"
                    style={{ textAlign: 'left' }}
                    onClick={() => setInput(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`msg-row ${m.role}`}>
              {m.role === 'assistant' && <div className="msg-avatar">H</div>}
              <div>
                <div className="msg-bubble">
                  {m.content}
                  {m.streaming && <span className="cursor-blink">▍</span>}
                </div>
                {m.failed && (
                  <div className="msg-failed">AI 回复失败：{streamError || '请重试'}</div>
                )}
                {m.role === 'assistant' && !m.streaming && m.content && (
                  <div className="msg-meta">
                    <button className="msg-copy" onClick={() => copy(m.content)}>
                      <CopyIcon size={13} /> 复制
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="chat-composer">
          <div className="quick-chips">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                className="chip"
                onClick={() => setInput((v) => (v ? v + ' ' : '') + s)}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="composer-row">
            <textarea
              className="textarea"
              rows={1}
              placeholder="说说你的近况、问题、困惑……"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  send()
                }
              }}
            />
            <button
              className="send-btn"
              onClick={send}
              disabled={sending || !input.trim()}
              title="发送"
            >
              <SendIcon size={18} />
            </button>
          </div>
          <div className="composer-foot">
            <span className="faint">Enter 发送 · Shift+Enter 换行</span>
            <span className="faint">Harry 会记住你的档案与近况</span>
          </div>
        </div>
      </div>
    </div>
  )
}
