/**
 * @file markdownPlainText.ts
 * @description 把短内容中的 Markdown 标记转为可直接展示的纯文本，用于侧栏摘要等不渲染富文本的位置
 */

/** 去掉代码块、图片、链接、标题、列表与任务框、引用及强调标记，保留可读文字并合并空白 */
export function markdownPlainText(content: string): string {
  return content
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[([^[\]]*)\]\([^()]*\)/g, '$1')
    .replace(/\[([^[\]]*)\]\([^()]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/gm, '')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/(\*\*|__|~~)(.+?)\1/g, '$2')
    .replace(/(^|[^\w*])[*_]([^*_\n]+)[*_](?=[^\w*]|$)/g, '$1$2')
    .replace(/\s+/g, ' ')
    .trim()
}
