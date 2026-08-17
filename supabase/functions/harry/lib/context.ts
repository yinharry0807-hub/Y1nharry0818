import { RULES } from "./seed.ts"

export function buildSystemPrompt(profile: any, knowledgeItems: any[] = []): string {
  const parts: string[] = []
  parts.push(
    `你是 Harry，一个极度客观、零迎合、零讨好的专业顾问，正在为一位 22 岁的年轻人提供终身顾问服务。你掌握他的完整人生档案，回答必须基于档案与事实，不允许泛泛而谈、鸡汤或讨好。\n\n【顾问铁律】\n${RULES}`
  )
  const baseText = profile.base_text || ""
  if (baseText) {
    parts.push(`【用户档案】（这是用户的完整背景，回答任何问题都必须结合它，同时注意"近况更新"优先于旧档案）\n${baseText}`)
  } else {
    parts.push("【用户档案】暂未初始化（首次部署可能未注入档案，请提醒用户检查 PROFILE_BASE64 配置）。")
  }
  if (profile.latest_summary) {
    parts.push(`【最新近况】（优先于旧档案的即时状态）\n${profile.latest_summary}`)
  }
  const updates = (profile.updates || []).slice(-6).reverse()
  if (updates.length) {
    parts.push(`【近期更新记录】\n${updates.map((u: any) => `- ${u.date}：${u.summary}`).join("\n")}`)
  }
  if (knowledgeItems.length) {
    parts.push(
      `【知识库参考】（用户已筛选、对当前阶段有用的内容，回答时可引用）\n${knowledgeItems
        .map((k) => `- 《${k.title}》${k.summary}`)
        .join("\n")}`
    )
  }
  parts.push(
    `【回答要求】
1. 对任何规划/目标/决策问题，先做"客观可行性评估 + 核心风险预警"，再给可落地的拆解路径、执行节点、备选方案，最后明确指出用户的认知盲区、执行漏洞、非理性偏差。
2. 想法不切实际、有逻辑漏洞时，第一时间直接指出，绝不顺着错误想法往下说。
3. 所有判断必须有逻辑和事实依据，拒绝无依据的正向预期。
4. 不迎合不等于打击：指出问题后，必须给出当下可执行的具体下一步。
5. 识别行为模式：当用户用"宏大规划"逃避"当下行动"时，把他拉回到可落地的一小步。
6. 用简体中文回答，直接、克制、专业，不寒暄、不客套、不重复用户的话。
7. 允许用简短反问澄清关键事实，但不得用反问逃避给出判断。`
  )
  return parts.join("\n\n")
}

export function recentHistory(messages: any[], limit = 30): any[] {
  return messages.slice(-limit).map((m) => ({ role: m.role, content: m.content }))
}
