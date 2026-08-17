import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { CheckIcon, CopyIcon, TrashIcon } from '../lib/icons.jsx'

const ROLES = [
  { value: 'supply', label: '供应链 / 采购岗' },
  { value: 'merchandise', label: '跨境电商商品岗' },
  { value: 'general', label: '通用版本' }
]

export default function Resume({ onToast }) {
  const [versions, setVersions] = useState([])
  const [targetRole, setTargetRole] = useState('supply')
  const [raw, setRaw] = useState('')
  const [generating, setGenerating] = useState(false)
  const [draft, setDraft] = useState('')
  const [name, setName] = useState('')
  const [mode, setMode] = useState('edit')
  const [activeId, setActiveId] = useState(null)
  const [copied, setCopied] = useState(false)

  const load = async () => {
    try {
      const d = await api('/api/resumes')
      setVersions(d.versions)
    } catch (e) {
      onToast(e.message)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const generate = async () => {
    if (generating) return
    setGenerating(true)
    try {
      const d = await api('/api/resumes/generate', {
        method: 'POST',
        body: { targetRole, raw }
      })
      setDraft(d.markdown)
      setMode('edit')
      setActiveId(null)
      setName('')
      onToast(d.usedFallback ? '已生成（模型已自动切换）' : '已生成，可继续编辑')
    } catch (e) {
      onToast(e.message)
    } finally {
      setGenerating(false)
    }
  }

  const save = async () => {
    if (!draft.trim()) return
    const roleLabel = ROLES.find((r) => r.value === targetRole)?.label || '简历'
    const finalName =
      name.trim() || `${roleLabel} ${new Date().toLocaleDateString('zh-CN')}`
    try {
      if (activeId) {
        await api(`/api/resumes/${activeId}`, {
          method: 'PUT',
          body: { name: finalName, targetRole, content: draft }
        })
        onToast('已更新版本')
      } else {
        await api('/api/resumes', {
          method: 'POST',
          body: { name: finalName, targetRole, content: draft }
        })
        onToast('已保存为新版本')
      }
      load()
    } catch (e) {
      onToast(e.message)
    }
  }

  const loadVersion = (v) => {
    setDraft(v.content)
    setActiveId(v.id)
    setName(v.name)
    setTargetRole(v.target_role || 'supply')
    setMode('edit')
  }

  const removeVersion = async (id) => {
    if (!window.confirm('删除这个简历版本？')) return
    try {
      await api(`/api/resumes/${id}`, { method: 'DELETE' })
      if (activeId === id) {
        setActiveId(null)
        setDraft('')
        setName('')
      }
      load()
    } catch (e) {
      onToast(e.message)
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(draft)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      onToast('复制失败')
    }
  }

  return (
    <div className="page page-narrow">
      <h2>简历工作台</h2>
      <div className="sub">只做措辞优化和重点突出，不编造不存在的核心经历</div>

      <div className="card">
        <div className="label">目标岗位版本</div>
        <div className="row">
          <select
            className="select"
            value={targetRole}
            onChange={(e) => setTargetRole(e.target.value)}
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <span className="faint">简历语言将按这个方向调整侧重点</span>
        </div>
        <div className="label mt">原始经历素材（可粘贴你写的经历；留空则只用档案中的真实事实）</div>
        <textarea
          className="textarea"
          rows={4}
          placeholder="例：2026年至今在某跨境服饰公司做开发跟单及大货跟单，负责品牌订单从开发到大货出货的全流程跟进……"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
        />
        <div className="row mt">
          <button className="btn btn-primary" onClick={generate} disabled={generating}>
            {generating ? (
              <>
                <div className="spinner sm" /> Harry 正在润色…
              </>
            ) : (
              '生成简历草稿'
            )}
          </button>
        </div>
      </div>

      {draft && (
        <div className="card">
          <div className="spread">
            <div className="label" style={{ margin: 0 }}>
              草稿
            </div>
            <div className="row">
              <button className="btn btn-sm" onClick={() => setMode(mode === 'edit' ? 'preview' : 'edit')}>
                {mode === 'edit' ? '预览' : '编辑'}
              </button>
              <button className="btn btn-sm" onClick={copy}>
                {copied ? (
                  <>
                    <CheckIcon size={13} /> 已复制
                  </>
                ) : (
                  <>
                    <CopyIcon size={13} /> 复制
                  </>
                )}
              </button>
            </div>
          </div>
          {mode === 'edit' ? (
            <textarea
              className="textarea resume-editor mt"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
          ) : (
            <div className="resume-preview mt">
              {draft.split('\n').map((line, i) => {
                if (line.startsWith('## ')) return <h4 key={i}>{line.slice(3)}</h4>
                if (line.startsWith('# ')) return <h3 key={i}>{line.slice(2)}</h3>
                if (line.trim().startsWith('- '))
                  return (
                    <div key={i} className="bullet">
                      • {line.trim().slice(2)}
                    </div>
                  )
                if (!line.trim()) return <div key={i} style={{ height: 8 }} />
                return <p key={i}>{line}</p>
              })}
            </div>
          )}
          <div className="row mt">
            <input
              className="input"
              style={{ flex: 1 }}
              placeholder="版本名称（留空自动命名）"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button className="btn btn-primary" onClick={save}>
              保存版本
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="label" style={{ margin: 0 }}>
          已保存版本
        </div>
        <div className="mt">
          {versions.length === 0 && <p className="muted">暂无保存的版本</p>}
          {versions.map((v) => (
            <div
              key={v.id}
              className={`version-item ${activeId === v.id ? 'active' : ''}`}
              onClick={() => loadVersion(v)}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{v.name}</div>
                <div className="faint">
                  {v.target_role} · {new Date(v.updated_at).toLocaleDateString('zh-CN')}
                </div>
              </div>
              <button
                className="msg-copy"
                onClick={(e) => {
                  e.stopPropagation()
                  removeVersion(v.id)
                }}
              >
                <TrashIcon size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
