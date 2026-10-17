/**
 * @file absoluteUrl.ts
 * @description 分享元信息与结构化数据共用的地址工具：相对地址统一解析到公开站点，拒绝非 http(s) 与带凭据的地址
 * @author TixXin
 * @since 2026-10-18
 */

/** 把站内相对地址或外链规范为绝对地址；无法安全使用时返回 undefined，调用方据此不输出对应标签 */
export function absoluteUrl(value: string | null | undefined, base: string): string | undefined {
  if (!value) return undefined
  try {
    const url = new URL(value, base.replace(/\/$/, '') + '/')
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : undefined
  } catch {
    return undefined
  }
}

/** 社交平台的分享卡片普遍不支持 SVG，只有位图才能作为 og:image */
export function isShareableImage(value: string | undefined): value is string {
  if (!value) return false
  try {
    return !/\.svg$/i.test(new URL(value).pathname)
  } catch {
    return false
  }
}

/** JSON-LD 内联到 <script> 时转义 <，避免正文中的 </script> 提前结束脚本 */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

/** 从站点社交链接中识别 Twitter/X 账号，返回带 @ 的用户名 */
export function twitterHandle(links: { href: string }[]): string | undefined {
  for (const link of links) {
    try {
      const url = new URL(link.href)
      if (!/^(www\.)?(twitter|x)\.com$/i.test(url.hostname)) continue
      const name = url.pathname.split('/').filter(Boolean)[0]
      if (name && /^\w{1,15}$/.test(name)) return `@${name}`
    } catch {
      /* 非法地址跳过 */
    }
  }
  return undefined
}

/** 结构化数据 sameAs：只取站点社交链接中的公开网页地址（排除 mailto 等） */
export function socialProfiles(links: { href: string }[]): string[] {
  return links.flatMap((link) => {
    try {
      const url = new URL(link.href)
      return ['http:', 'https:'].includes(url.protocol) ? [url.href] : []
    } catch {
      return []
    }
  })
}
