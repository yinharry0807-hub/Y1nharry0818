-- Harry 个人顾问数据库结构
-- 在 Supabase 控制台 -> SQL Editor 中一次性执行

-- 1. 用户档案（单行，id 恒为 1）
create table if not exists public.user_profile (
  id integer primary key default 1 check (id = 1),
  base_text text not null default '',
  updates jsonb not null default '[]'::jsonb,
  latest_summary text not null default '',
  updated_at timestamptz not null default now()
);

-- 2. 对话
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  title text not null default '新对话',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. 消息
create table if not exists public.messages (
  id bigserial primary key,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  model text,
  created_at timestamptz not null default now()
);
create index if not exists idx_messages_conversation
  on public.messages (conversation_id, created_at);

-- 4. 知识库
create table if not exists public.knowledge_base (
  id uuid primary key default gen_random_uuid(),
  category text not null default '当前阶段有用',
  title text not null default '',
  summary text not null default '',
  reason text not null default '',
  original_content text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists idx_knowledge_category
  on public.knowledge_base (category, created_at desc);

-- 5. 简历版本
create table if not exists public.resume_versions (
  id uuid primary key default gen_random_uuid(),
  name text not null default '未命名版本',
  target_role text not null default '',
  content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 6. 资讯摘要
create table if not exists public.news_digest (
  id uuid primary key default gen_random_uuid(),
  mode text not null check (mode in ('daily', 'weekly')),
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_news_created
  on public.news_digest (created_at desc);

-- 说明：本项目所有数据库访问都通过后端 API 使用 service_role 密钥完成，
-- 因此无需开启 RLS（service_role 天然绕过 RLS）。请勿把 service_role 密钥放进前端。
