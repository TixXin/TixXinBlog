/**
 * @file markdownLinks.ts
 * @description Markdown 共用外链规则：区分博主与访客内容，保留站内导航，并追加新窗口图标与读屏说明
 */
import type MarkdownIt from 'markdown-it'

export interface MarkdownLinkOptions {
  /** 公开站点地址；由宿主传入，保证 SSR 与客户端使用同一个同源判定 */
  siteUrl?: string
  /** 评论和访客内容启用 nofollow ugc，博主正文默认不启用 */
  ugc?: boolean
}

export interface MarkdownLinkEnvironment {
  markdownLinks?: MarkdownLinkOptions
}

// v-html 不编译 Vue 组件；app.vue 的常驻 Icon 注册同一个 Lucide CSS 图标，首屏无需逐条挂载。
const newWindowHint =
  '<span class="markdown-link__icon iconify i-lucide:external-link" aria-hidden="true"></span>' +
  '<span class="sr-only">（在新窗口打开）</span>'

/** 相对路径、锚点和 mailto 等协议保留原行为；协议相对地址也按 HTTP(S) 外链检查 */
function isExternalLink(href: string, siteUrl?: string): boolean {
  let site: URL | undefined
  try {
    const candidate = new URL(siteUrl ?? '')
    if (/^https?:$/.test(candidate.protocol)) site = candidate
  } catch {
    // 未配置合法站点时保守地把绝对 HTTP(S) 地址视为外链，不读取浏览器 location。
  }
  try {
    const base = site ?? new URL('https://markdown.invalid')
    const link = new URL(href, base)
    // 交给 URL 按浏览器规则解析 http:host 等合法简写；缺少站点时仍为绝对地址采用保守策略。
    return (
      /^https?:$/.test(link.protocol) && (link.origin !== base.origin || (!site && /^(?:https?:|\/\/)/i.test(href)))
    )
  } catch {
    return false
  }
}

/** 规则在 linkify 和任务清单之后运行，选项仅取本次 render 的环境，不保存在共享解析器上 */
export function markdownLinks(md: MarkdownIt) {
  md.core.ruler.push('markdown-links', (state) => {
    const { siteUrl, ugc = false } = (state.env as MarkdownLinkEnvironment).markdownLinks ?? {}
    for (const block of state.tokens) {
      if (block.type !== 'inline' || !block.children) continue
      const children: typeof block.children = []
      const newWindows: boolean[] = []
      for (const token of block.children) {
        if (token.type === 'link_open') {
          const external = isExternalLink(token.attrGet('href') ?? '', siteUrl)
          if (external) token.attrSet('target', '_blank')
          const newWindow = token.attrGet('target') === '_blank'
          if (external || newWindow) {
            const rel = new Set((token.attrGet('rel') ?? '').toLowerCase().split(/\s+/).filter(Boolean))
            rel.delete('opener')
            for (const value of ['noopener', 'noreferrer', ...(ugc ? ['nofollow', 'ugc'] : [])]) rel.add(value)
            token.attrSet('rel', [...rel].join(' '))
          }
          newWindows.push(newWindow)
        } else if (token.type === 'link_close' && newWindows.pop()) {
          const hint = new state.Token('html_inline', '', 0)
          hint.content = newWindowHint
          children.push(hint)
        }
        children.push(token)
      }
      block.children = children
    }
  })
}
