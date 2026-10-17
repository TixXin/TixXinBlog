/**
 * @file cspSources.ts
 * @description 在运行时向 CSP 指令追加来源：预构建镜像不知道部署者的统计域名，构建期写死的策略需按运行时配置补充
 * @author TixXin
 * @since 2026-10-18
 */

/** 取脚本地址的 origin；非 http(s) 或无法解析时返回空串，避免把非法值写进响应头 */
export function scriptOrigin(url: string | undefined | null): string {
  if (!url) return ''
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.origin : ''
  } catch {
    return ''
  }
}

/** 把 source 追加到指定指令末尾；指令不存在时补一条，已包含时不重复 */
export function appendCspSource(policy: string, directives: string[], source: string): string {
  if (!source) return policy
  const parts = policy
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
  for (const directive of directives) {
    const index = parts.findIndex((part) => part.split(/\s+/)[0] === directive)
    if (index === -1) {
      parts.push(`${directive} 'self' ${source}`)
      continue
    }
    const tokens = parts[index]!.split(/\s+/)
    if (!tokens.includes(source)) parts[index] = [...tokens, source].join(' ')
  }
  return parts.join('; ')
}
