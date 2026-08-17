import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { TrashIcon } from '../lib/icons.jsx'

const TABS = ['全部', '当前阶段有用', '未来有用', '有误导性']
const BADGE = { '当前阶段有用': 'green', '未来有用': 'blue', '有误导性': 'red' }

export default function Knowledge({ onToast }) {
  const [items, setItems] = useState([])
  const [tab, setTab] = useState('全部')
  const [content, setContent] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [expanded, setExpanded] = useState({})

  const load = async () => {
    try {
      const d = await api('/api/knowledge')
      setItems(d.items)
    } catch (e) {
      onToast(e.message)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const add = async () => {
    if (!content.trim() || analyzing) return
    setAnalyzing(true)
    try {
      const d = await api('/api/knowledge', { method: 'POST', body: { content } })
      setContent('')
      onToast(`已分类：${d.item.category}`)
      load()
    } catch (e) {
      onToast(e.message)
    } finally {
      setAnalyzing(false)
    }
  }

  const remove = async (id) => {
    if (!window.confirm('删除这条知识？')) return
    try {
      await api(`/api/knowledge/${id}`, { method: 'DELETE' })
      load()
    } catch (e) {
      onToast(e.message)
    }
  }

  const filtered = tab === '全部' ? items : items.filter((i) => i.category === tab)

  return (
    <div className="page page-narrow">
      <h2>知识库</h2>
      <div className="sub">粘贴文章、视频总结、读书笔记、课程要点。Harry 会分类：对当前有用 / 封存备用 / 丢弃误导内容</div>

      <div className="card">
        <div className="label">粘贴知识内容</div>
        <textarea
          className="textarea"
          rows={5}
          placeholder="粘贴任何你觉得值得保存的内容……"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <div className="row mt">
          <button
            className="btn btn-primary"
            onClick={add}
            disabled={analyzing || !content.trim()}
          >
            {analyzing ? (
              <>
                <div className="spinner sm" /> AI 正在判断…
              </>
            ) : (
              '分析并存入知识库'
            )}
          </button>
        </div>
      </div>

      <div className="tabs mt">
        {TABS.map((t) => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t}
            {t !== '全部' && (
              <span className="faint"> ({items.filter((i) => i.category === t).length})</span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 && <div className="card muted">还没有内容</div>}
      {filtered.map((item) => (
        <div key={item.id} className="card kb-card">
          <div className="head spread">
            <span className={`badge ${BADGE[item.category] || 'gray'}`}>{item.category}</span>
            <button className="msg-copy" onClick={() => remove(item.id)}>
              <TrashIcon size={14} /> 删除
            </button>
          </div>
          <div className="title">{item.title}</div>
          <div className="summary">{item.summary}</div>
          <div className="reason">判断依据：{item.reason}</div>
          <button
            className="detail-toggle"
            onClick={() => setExpanded((e) => ({ ...e, [item.id]: !e[item.id] }))}
          >
            {expanded[item.id] ? '收起原文' : '查看原文'}
          </button>
          {expanded[item.id] && <div className="original">{item.original_content}</div>}
        </div>
      ))}
    </div>
  )
}
