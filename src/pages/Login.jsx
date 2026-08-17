import { useState } from 'react'
import { api } from '../lib/api.js'

export default function Login({ onLogin }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!password || loading) return
    setLoading(true)
    setError('')
    try {
      const d = await api('/api/auth/login', { method: 'POST', body: { password } })
      onLogin(d.token)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="login-logo">
          <div className="logo-mark" style={{ width: 56, height: 56, fontSize: 26 }}>
            H
          </div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>Harry · 个人专属顾问</div>
          <div className="faint" style={{ textAlign: 'center' }}>
            只服务一个人的终身 AI 顾问
            <br />
            输入密码进入
          </div>
        </div>
        <input
          className="input"
          type="password"
          placeholder="访问密码"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
        {error && <div className="login-error">{error}</div>}
        <button className="btn btn-primary btn-block mt" disabled={loading || !password}>
          {loading ? '验证中…' : '进入'}
        </button>
      </form>
    </div>
  )
}
