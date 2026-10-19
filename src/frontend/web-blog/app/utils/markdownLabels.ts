/**
 * @file markdownLabels.ts
 * @description Markdown 渲染输出中的界面文案（代码块标签、查看大图、新窗口读屏提示）：
 *              使用调用方传入的翻译函数；未传入时（订阅全文等服务端渲染没有 i18n 实例）回退到与 zh-CN 字典一致的中文。
 *              本模块会被 Nitro 服务端代码引用，不能依赖 Nuxt 应用上下文（tryUseNuxtApp 在服务端包中不可用）
 * @author TixXin
 * @since 2026-10-19
 */
/**
 * 翻译函数形态，与 ~/utils/format 的 Translate 结构相同；本地声明以免服务端类型检查引入依赖 Nuxt 上下文的 format.ts
 */
export type MarkdownTranslate = (key: string, params?: Record<string, unknown>) => string

/** 未传入翻译函数时的中文兜底；与 i18n/locales/zh-CN/article.json 的同名条目逐字一致，由单测校验 */
export const MARKDOWN_FALLBACK_LABELS: Readonly<Record<string, string>> = {
  'article.markdown.code': '代码',
  'article.markdown.plainText': '文本',
  'article.markdown.viewImage': '查看大图',
  'article.markdown.viewImageWithAlt': '查看大图：{alt}',
  'article.markdown.newWindow': '（在新窗口打开）',
}

/** 渲染时求值的文案；没有翻译函数或翻译结果仍是 key 本身时，按兜底表插值 */
export function markdownLabel(t: MarkdownTranslate | undefined, key: string, params?: Record<string, unknown>): string {
  const text = t?.(key, params)
  if (text && text !== key) return text
  const fallback = MARKDOWN_FALLBACK_LABELS[key] ?? key
  return fallback.replace(/\{(\w+)\}/g, (match, name: string) =>
    params && name in params ? String(params[name]) : match,
  )
}
