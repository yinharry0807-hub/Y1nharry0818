import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { CheckIcon, CloseIcon, LogoutIcon } from '../lib/icons.jsx'

export default function Settings({ config, onLogout, onToast }) {
  const [cfg, setCfg] = useState(config)

  useEffect(() => {
    if (!cfg) {
      api('/api/config')
        .then(setCfg)
        .catch((e) => onToast(e.message))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="page page-narrow">
      <h2>设置</h2>
      <div className="sub">运行状态、登录与安全</div>

      <div className="card">
        <div className="label" style={{ margin: 0 }}>
          运行状态
        </div>
        <div className="mt">
          <div className="setting-row">
            <span>AI 服务（DeepSeek）</span>
            {cfg?.deepseekConfigured ? (
              <span className="badge green">
                <CheckIcon size={12} /> 已配置
              </span>
            ) : (
              <span className="badge red">
                <CloseIcon size={12} /> 未配置
              </span>
            )}
          </div>
          <div className="setting-row">
            <span>数据存储</span>
            {cfg?.supabaseConfigured ? (
              <span className="badge green">
                <CheckIcon size={12} /> Supabase 云端
              </span>
            ) : (
              <span className="badge blue">
                <CheckIcon size={12} /> 本地模式（开发用）
              </span>
            )}
          </div>
          <div className="setting-row">
            <span>可用模型</span>
            <span className="faint">{(cfg?.models || []).join('、') || 'deepseek-chat'}</span>
          </div>
          <div className="setting-row">
            <span>默认模型</span>
            <span className="faint">{cfg?.defaultModel || 'deepseek-chat'}</span>
          </div>
        </div>
        <p className="faint mt">
          修改模型列表、默认模型、密码等，需要在 GitHub 仓库 Secret / Supabase 密钥中调整（见 README）。
        </p>
      </div>

      <div className="card">
        <div className="label" style={{ margin: 0 }}>
          登录
        </div>
        <div className="setting-row">
          <span>当前状态</span>
          <span className="badge green">
            <CheckIcon size={12} /> 已登录
          </span>
        </div>
        <div className="row mt">
          <button className="btn btn-danger" onClick={onLogout}>
            <LogoutIcon size={15} /> 退出登录
          </button>
        </div>
      </div>

      <div className="card">
        <div className="label" style={{ margin: 0 }}>
          手机添加到主屏幕（PWA）
        </div>
        <div className="muted mt" style={{ lineHeight: 2 }}>
          iPhone / iPad：Safari 打开网址 → 分享按钮 → 「添加到主屏幕」。
          <br />
          安卓：Chrome 打开网址 → 右上角菜单 → 「安装应用」。
        </div>
      </div>

      <div className="card">
        <div className="label" style={{ margin: 0 }}>
          安全提醒
        </div>
        <p className="muted mt" style={{ lineHeight: 2 }}>
          · 访问密码（APP_PASSWORD）和 DeepSeek Key 都存在服务端环境变量，不会暴露给前端。
          <br />
          · Supabase 的 service_role 密钥权限极大，只允许放在服务端环境变量里，不要泄露。
          <br />
          · 首次部署后请立即修改默认密码 harry2026。
        </p>
      </div>
    </div>
  )
}
