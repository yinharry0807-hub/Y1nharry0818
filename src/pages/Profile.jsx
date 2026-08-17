import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'

export default function Profile({ onToast }) {
  const [profile, setProfile] = useState(null)
  const [text, setText] = useState('')
  const [updating, setUpdating] = useState(false)
  const [expanded, setExpanded] = useState({})
  const [showBase, setShowBase] = useState(false)

  const load = async () => {
    try {
      const d = await api('/api/profile')
      setProfile(d.profile)
    } catch (e) {
      onToast(e.message)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const update = async () => {
    if (!text.trim() || updating) return
    setUpdating(true)
    try {
      const d = await api('/api/profile/update', { method: 'POST', body: { text } })
      setProfile(d.profile)
      setText('')
      onToast(`已更新档案：${d.extracted.summary}`)
    } catch (e) {
      onToast(e.message)
    } finally {
      setUpdating(false)
    }
  }

  if (!profile) {
    return (
      <div className="loading-screen">
        <div className="spinner" /> 加载档案…
      </div>
    )
  }

  const updates = Array.isArray(profile.updates) ? profile.updates : []

  return (
    <div className="page page-narrow">
      <h2>我的档案</h2>
      <div className="sub">近况会自动成为 Harry 回答时优先参考的最新记忆</div>

      <div className="card">
        <div className="label">记录最新近况（工作 / 财务 / 目标 / 心态 / 健身 / 学习…）</div>
        <textarea
          className="textarea"
          rows={4}
          placeholder="例：今天被领导安排对接一个英国客户，英语沟通压力很大；这个月已存 2500 元……"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="row mt">
          <button
            className="btn btn-primary"
            onClick={update}
            disabled={updating || !text.trim()}
          >
            {updating ? (
              <>
                <div className="spinner sm" /> 正在提取…
              </>
            ) : (
              '更新我的档案'
            )}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="spread">
          <div className="label" style={{ margin: 0 }}>
            Harry 当前掌握的最新状态
          </div>
          <span className="badge gray">{updates.length} 条更新</span>
        </div>
        {profile.latest_summary ? (
          <p style={{ margin: '10px 0 0', color: 'var(--accent-strong)' }}>
            {profile.latest_summary}
          </p>
        ) : (
          <p className="muted mt">还没有近况记录。用上面的输入框告诉 Harry 你最近的变化。</p>
        )}
      </div>

      <div className="card">
        <div className="spread">
          <div className="label" style={{ margin: 0 }}>
            完整用户档案（永久记忆）
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowBase((v) => !v)}>
            {showBase ? '收起' : '展开'}
          </button>
        </div>
        {showBase && <div className="profile-text mt">{profile.base_text}</div>}
      </div>

      <div className="card">
        <div className="label" style={{ margin: 0 }}>
          近况时间线（倒序）
        </div>
        <div className="mt">
          {updates.length === 0 && <p className="muted">暂无记录</p>}
          {[...updates].reverse().map((u, i) => (
            <div key={i} className="update-item">
              <div className="faint">{u.date}</div>
              <div>{u.summary}</div>
              <div className="tags">
                {(u.tags || []).map((t) => (
                  <span key={t} className="badge gray">
                    {t}
                  </span>
                ))}
              </div>
              <button
                className="detail-toggle"
                onClick={() => setExpanded((e) => ({ ...e, [i]: !e[i] }))}
              >
                {expanded[i] ? '收起原文' : '查看原文'}
              </button>
              {expanded[i] && <div className="original">{u.text}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
