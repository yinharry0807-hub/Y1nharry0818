# Harry · 个人专属顾问

一个只服务你一个人的终身 AI 顾问 Web 应用。

Harry 内置你的完整人生档案（背景、财务、职业、性格弱点、心理机制、认知误区、顾问铁律），
按"绝对客观、零迎合、零讨好"的原则与你对话；支持近况自动更新档案、知识库筛选、简历润色、
每日/每周资讯推荐。数据存在 Supabase 云端，电脑和手机打开自动同步，支持 PWA 添加到手机主屏幕。

> 不需要 Vercel、不需要外国手机号。
> 后端跑在 Supabase 自家的 Edge Functions 上（你反正要注册 Supabase 存数据），
> 前端放在 GitHub Pages，全部由 GitHub Actions 自动部署。

---

## 你要做的全部事情（约 15 分钟）

代码、AI 接入、数据库表结构、部署脚本都已准备好。剩下四步：

### ① 创建 Supabase 项目（8 分钟，邮箱注册即可，无需外国手机号）

1. 打开 [supabase.com](https://supabase.com) → Sign Up（用邮箱注册）→ New Project
2. 项目名称随意（如 `harry`），设置数据库密码，Region 选 **Singapore** 或 **Tokyo**，Create
3. 进入 **SQL Editor**，把 `supabase/schema.sql` 全部内容粘贴进去 → **Run**（一次建好 6 张表）
4. **Project Settings → API**，复制两个值备用：
   - `Project URL`（形如 `https://xxxx.supabase.co`）
   - `service_role` 密钥（一长串，权限很大，只能放秘密里，别泄露）
5. **Project Settings → General**，复制 `Reference ID`（形如 `abcdefghijklmno`，就是项目 URL 里的那串）
6. 右上角头像 → **Account Settings → Access Tokens → Generate new token**，
   名字填 `harry-deploy`，复制生成的 `sbp_` 开头的令牌（只显示一次）

### ② 创建 GitHub 仓库并填入 7 个秘密（5 分钟）

1. 打开 [github.com](https://github.com) → New repository → 名称填 `harry-advisor`
2. **Visibility 选 Public**（原因见下方"为什么仓库必须公开"），不要勾选任何自动生成文件 → Create
3. 进入仓库 → **Settings → Secrets and variables → Actions → New repository secret**，
   依次添加下面 7 个：

| 秘密名 | 填什么 |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN` | 第①步第 6 点的 `sbp_...` 令牌 |
| `SUPABASE_PROJECT_ID` | 第①步第 5 点的 Reference ID |
| `SUPABASE_URL` | 第①步第 4 点的 Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | 第①步第 4 点的 service_role 密钥 |
| `DEEPSEEK_API_KEY` | 你的 DeepSeek 密钥 |
| `APP_PASSWORD` | 你自己设的登录密码（字母数字组合，别太简单） |
| `PROFILE_BASE64` | 我单独给你的 `harry-advisor-PROFILE_BASE64.txt` 里的整串字符 |

4. 仓库 **Settings → Pages** → Source 选 **GitHub Actions** → Save
5. 把代码传上去（两种方式任选）：
   - 网页拖拽：解压我给你的 zip → 仓库首页 **Add file → Upload files** → 全选拖进去 → Commit
   - 命令行：见文末"推送代码"

### ③ 等自动部署（2-3 分钟）

代码 push 上去后，GitHub Actions 会自动：
1. 把上面 7 个秘密注入 Supabase Edge Function
2. 部署后端函数 `harry`
3. 构建前端并发布到 GitHub Pages

可以在仓库 **Actions** 页面看进度；完成后打开：

```
https://你的GitHub用户名.github.io/harry-advisor/
```

用第②步设置的 `APP_PASSWORD` 登录。

### ④ 手机收尾（1 分钟）

手机浏览器打开上面的网址 → 添加到主屏幕（iPhone 用 Safari 的"分享 → 添加到主屏幕"，
安卓用 Chrome 菜单 →"安装应用"），就是全屏 App。

以后想改任何东西：改完代码 push 上去，Actions 自动重新部署。

---

## 为什么仓库必须公开？

GitHub Pages 免费版只支持**公开仓库**（私有仓库要付费升级才能开 Pages）。

但你可以放心公开，因为：
- 仓库里没有任何你的个人数据：你的完整档案以 `PROFILE_BASE64` 秘密的形式在部署时才注入服务器，代码里找不到
- 所有 API 密钥都存在 GitHub Secrets 里，不会进代码
- 网站本身虽然任何人能打开登录页，但数据有密码保护，没密码什么都看不到

如果你以后升级了 GitHub Pro 想让仓库私有，直接把仓库改成 Private 即可，Pages 不受影响。

## 技术架构

```
浏览器（手机/电脑，PWA）
    │  你的档案存在 Supabase Postgres，多端同步
    ▼
GitHub Pages 托管前端（静态 React）
    │  HTTPS 调用
    ▼
Supabase Edge Function（/functions/v1/harry）
    ├── DeepSeek API（密钥只在函数秘密里）
    └── Supabase Postgres（对话/档案/知识库/简历/资讯）
```

- 前端：React 18 + Vite，深色主题，响应式（手机底部导航 / 电脑侧边栏）
- 后端：Supabase Edge Functions（Deno），路由与业务都在 `supabase/functions/harry/`
- 数据库：Supabase Postgres（免费额度 500MB，个人使用绰绰有余）
- 部署：GitHub Actions 一条流水线搞定函数部署 + 前端发布
- 认证：个人密码（`APP_PASSWORD`），HMAC 签名 Token 有效期 30 天

## 目录结构

```
harry-advisor/
├── supabase/
│   ├── functions/harry/      # 后端函数（入口 index.ts + lib/ 共享逻辑）
│   ├── schema.sql            # 建表 SQL（在 Supabase SQL Editor 执行一次）
│   └── config.toml           # 函数配置（关闭 JWT 校验，改用应用自己的密码登录）
├── src/                      # 前端（页面、组件、样式）
├── public/                   # PWA（manifest、service worker、图标）
├── .github/workflows/        # ci.yml 构建检查 + deploy.yml 自动部署
├── scripts/make-icons.ps1    # 重新生成应用图标
├── deno.json / package.json / vite.config.js
└── .env.example              # 本地开发环境变量模板
```

## 本地运行（可选，先在电脑上试通）

需要先安装：
- [Node.js](https://nodejs.org) 18+
- [Deno](https://deno.com)（Windows 可用 `winget install DenoLand.Deno`）

```bash
cd harry-advisor
npm install
copy .env.example .env        # Windows；macOS/Linux 用 cp
# 编辑 .env：填 DEEPSEEK_API_KEY、PROFILE_BASE64（和 GitHub 秘密里同一个值）、APP_PASSWORD
npm run dev
```

浏览器打开 http://localhost:5173 即可。
没配置 Supabase 时，数据自动存在本地 `.data/` 目录，方便先体验全部功能。

## 数据库表（schema.sql 已建好）

| 表 | 用途 |
| --- | --- |
| `user_profile` | 你的完整档案 + 近况更新（单行） |
| `conversations` / `messages` | 对话记录 |
| `knowledge_base` | 知识库（含 AI 分类） |
| `resume_versions` | 简历多版本 |
| `news_digest` | 每日/每周资讯 |

## 常见问题

**登录提示"密码错误"或"未配置"**：`APP_PASSWORD` 秘密没设对，或改了后没重新部署
（改秘密后随便 push 一次空提交触发 Actions）。

**对话里 Harry 说"档案未初始化"**：`PROFILE_BASE64` 没设对。
检查 GitHub 秘密是否完整粘贴了单独给你的文件内容，然后重新触发部署。

**Actions 部署失败**：打开仓库 Actions 页面看红色步骤的日志。
最常见原因：7 个秘密缺了某个、`SUPABASE_PROJECT_ID` 抄错、Access Token 过期。

**打开网址 404 / 白屏**：确认仓库 Settings → Pages 的 Source 是 **GitHub Actions**，
且 Actions 里的 "Deploy to GitHub Pages" 步骤成功。

**函数返回 401（非"未登录"）**：正常情况下函数已关闭 Supabase 自带的 JWT 校验
（config.toml 里 `verify_jwt = false`）；如果部署时没生效，重新 push 触发一次。

**资讯是实时新闻吗？** 不是。由 AI 基于其知识生成，标注了"为什么对你有用"；
涉及具体招聘/行业数据时请自行核实。

**费用**：Supabase 免费额度（Postgres 500MB + Edge Functions 50 万次/月）对个人完全够用；
GitHub 公开仓库 Actions 免费。唯一会花钱的是 DeepSeek API 的 token 消耗，按量计费很便宜。

## 安全说明

- DeepSeek Key、Supabase service_role、登录密码、个人档案全部以秘密形式存在服务端，
  前端代码里拿不到任何密钥
- 登录用 HMAC 签名 Token，未登录请求一律 401
- CORS 对任意来源开放是因为认证靠 Bearer Token：跨站网站无法读取你的数据（会被预检拦截）
- 如果你的 Supabase 项目要对外开放其他客户端，请另行配置 RLS 策略

## 推送代码（命令行方式）

```bash
cd C:\Users\15813\Documents\Codex\2026-08-17\ai-22-2026-2026-10-178cm\outputs\harry-advisor
git remote add origin https://github.com/你的用户名/harry-advisor.git
git push -u origin main
```

（仓库已初始化好并提交完成，直接 push 即可；如果用网页拖拽上传，可以跳过这段。）
