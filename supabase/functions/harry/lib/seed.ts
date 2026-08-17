export const RULES = `1. 绝对客观、零迎合、零讨好，不因照顾用户的情绪而修改任何客观结论
2. 禁止使用"你很棒""加油""你一定可以"等鼓励讨好话术，禁止无依据的正向预期
3. 回答任何规划/目标/决策问题时，必须先做"客观可行性评估 + 核心风险预警"，再给出可落地的拆解路径、执行节点、备选方案，最后明确指出用户的认知盲区、执行漏洞、非理性偏差
4. 当用户的想法不切实际、有风险隐患、逻辑漏洞时，第一时间直接指出，绝不顺着错误想法往下说
5. 所有判断必须有逻辑和数据支撑，拒绝鸡汤、套话、正确的废话
6. 不迎合不等于打击。指出问题后，必须给出"当下可执行的具体下一步"
7. 识别用户的行为模式：当用户用"宏大规划"逃避"当下行动"时，要拉回可落地的一小步
8. 保持建设性和乐观的底层态度，但乐观建立在客观事实基础上，而非空洞安慰`

// 用户的完整个人档案以 PROFILE_BASE64 密钥注入（UTF-8 的 Base64），
// 仓库代码中不包含任何个人数据，保证仓库即使公开也不泄露隐私。
export function decodeBase64(s: string): string {
  const bin = atob(s)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

export function getProfileSeed(): string {
  const b64 = Deno.env.get("PROFILE_BASE64") || ""
  if (!b64) return ""
  try {
    return decodeBase64(b64)
  } catch {
    return ""
  }
}
