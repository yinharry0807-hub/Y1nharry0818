import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { TrashIcon } from '../lib/icons.jsx'

const CAT_BADGE = { 行业动态: 'gold', 求职机会: 'blue', 技能学习: 'green', 认知成长: 'gray' }

export default function News({ onToast }) {
  const [digests, setDigests] = useState([])
  const [loading, setLoading] = useState(null)

  const load = async () => {
    try {
      const d = await api('/api/news')
      setDigests(d.digests)
    } catch (e) {
      onToast(e.message)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const generate = async (mode) => {
    setLoading(mode)
    try {
      const d = await api('/api/news/generate', { method: 'POST', body: { mode } })
      setDigests((list) => [d.digest, ...list])
      onToast(mode === 'daily' ? '今日一条已生成' : '每周一辑已生成')
    } catch (e) {
      onToast(e.message)
    } finally {
      setLoading(null)
    }
  }

  const remove = async (id) => {
    if (!window.confirm('删除这份资讯？')) return
    try {
      await api(`/api/news/${id}`, { method: 'DELETE' })
      load()
    } catch (e) {
      onToast(e.message)
    }
  }

  return (
    <div className="page page-narrow">
      <h2>资讯推荐</h2>
      <div className="sub">
        按你的背景（跨境供应链 / 服装行业 / 广深求职 / 英语 / AI / 健身）精选内容，每条都说明"为什么对你有用"
      </div>

      <div className="card">
        <div className="row">
          <button className="btn btn-primary" onClick={() => generate('daily')} disabled={loading}>
            {loading === 'daily' ? (
              <>
                <div className="spinner sm" /> 生成中…
              </>
            ) : (
              '生成今日一条'
            )}
          </button>
          <button className="btn" onClick={() => generate('weekly')} disabled={loading}>
            {loading === 'weekly' ? (
              <>
                <div className="spinner sm" /> 生成中…
              </>
            ) : (
              '生成每周一辑（6条）'
            )}
          </button>
        </div>
        <p className="faint mt">
          说明：资讯由 AI 基于其知识生成，不是实时新闻抓取；涉及具体招聘、行业数据时请自行核实。
        </p>
      </div>

      {digests.length === 0 && <div className="card muted mt">还没有生成过资讯</div>}
      {digests.map((d) => (
        <div key={d.id} className="card">
          <div className="spread">
            <div className="row">
              <span className={`badge ${d.mode === 'daily' ? 'gold' : 'blue'}`}>
                {d.mode === 'daily' ? '每日一条' : '每周一辑'}
              </span>
              <span className="faint">{new Date(d.created_at).toLocaleString('zh-CN')}</span>
            </div>
            <button className="msg-copy" onClick={() => remove(d.id)}>
              <TrashIcon size={14} />
            </button>
          </div>
          {(d.items || []).map((item, i) => (
            <div key={i} className="news-item">
              <div className="row">
                <span className={`badge ${CAT_BADGE[item.category] || 'gray'}`}>
                  {item.category || '未分类'}
                </span>
                <b>{item.title}</b>
              </div>
              <div className="muted" style={{ marginTop: 6 }}>
                {item.summary}
              </div>
              {item.why_useful && (
                <div className="why">
                  <b>为什么对你有用：</b>
                  {item.why_useful}
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
