import { useEffect, useState } from 'react'
import { api, getToken, setToken as saveToken } from './lib/api.js'
import { ChatIcon, UserIcon, BookIcon, DocIcon, NewsIcon, SettingsIcon } from './lib/icons.jsx'
import Login from './pages/Login.jsx'
import Chat from './pages/Chat.jsx'
import Profile from './pages/Profile.jsx'
import Knowledge from './pages/Knowledge.jsx'
import Resume from './pages/Resume.jsx'
import News from './pages/News.jsx'
import Settings from './pages/Settings.jsx'

const NAV = [
  { key: 'chat', label: '对话', icon: ChatIcon },
  { key: 'profile', label: '档案', icon: UserIcon },
  { key: 'knowledge', label: '知识库', icon: BookIcon },
  { key: 'resume', label: '简历', icon: DocIcon },
  { key: 'news', label: '资讯', icon: NewsIcon }
]

const TITLES = {
  chat: '对话',
  profile: '我的档案',
  knowledge: '知识库',
  resume: '简历工作台',
  news: '资讯推荐',
  settings: '设置'
}

export default function App() {
  const [token, setToken] = useState(() => getToken())
  const [checking, setChecking] = useState(() => Boolean(getToken()))
  const [page, setPage] = useState('chat')
  const [config, setConfig] = useState(null)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    if (!token) {
      setChecking(false)
      return
    }
    let alive = true
    setChecking(true)
    api('/api/auth/status')
      .then(() => api('/api/config'))
      .then((c) => {
        if (alive) {
          setConfig(c)
          setChecking(false)
        }
      })
      .catch(() => {
        if (alive) {
          saveToken('')
          setToken(null)
          setChecking(false)
        }
      })
    return () => {
      alive = false
    }
  }, [token])

  const showToast = (msg) => {
    setToast(msg)
    window.clearTimeout(showToast._timer)
    showToast._timer = window.setTimeout(() => setToast(null), 3200)
  }

  if (checking) {
    return (
      <div className="loading-screen">
        <div className="spinner" /> 正在验证登录…
      </div>
    )
  }

  if (!token) {
    return (
      <Login
        onLogin={(t) => {
          saveToken(t)
          setToken(t)
        }}
      />
    )
  }

  const logout = () => {
    saveToken('')
    setToken(null)
    setPage('chat')
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="logo">
          <div className="logo-mark">H</div>
          <div>
            <div className="logo-title">Harry 顾问</div>
            <div className="logo-sub">终身专属 · 零迎合</div>
          </div>
        </div>
        <nav className="nav">
          {NAV.map((n) => (
            <button
              key={n.key}
              className={`nav-item ${page === n.key ? 'active' : ''}`}
              onClick={() => setPage(n.key)}
            >
              <span className="ico">
                <n.icon size={17} />
              </span>
              {n.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <button
            className={`nav-item ${page === 'settings' ? 'active' : ''}`}
            onClick={() => setPage('settings')}
          >
            <span className="ico">
              <SettingsIcon size={17} />
            </span>
            设置
          </button>
        </div>
      </aside>

      <div className="main">
        {page !== 'chat' && (
          <header className="topbar">
            <h1>{TITLES[page] || 'Harry'}</h1>
            <div className="spacer" />
            <button className="btn btn-ghost btn-sm mobile-only" onClick={() => setPage('settings')}>
              <SettingsIcon size={17} />
            </button>
          </header>
        )}
        <main className="content">
          {page === 'chat' && (
            <Chat config={config} onToast={showToast} onOpenSettings={() => setPage('settings')} />
          )}
          {page === 'profile' && <Profile onToast={showToast} />}
          {page === 'knowledge' && <Knowledge onToast={showToast} />}
          {page === 'resume' && <Resume onToast={showToast} />}
          {page === 'news' && <News onToast={showToast} />}
          {page === 'settings' && <Settings config={config} onLogout={logout} onToast={showToast} />}
        </main>
      </div>

      <nav className="bottom-nav">
        {NAV.map((n) => (
          <button
            key={n.key}
            className={page === n.key ? 'active' : ''}
            onClick={() => setPage(n.key)}
          >
            <n.icon size={20} />
            <span>{n.label}</span>
          </button>
        ))}
      </nav>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
