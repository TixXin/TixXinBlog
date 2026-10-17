/**
 * @file markdownTaskLabels.ts
 * @description markdown-it 插件：为 markdown-it-task-lists 输出的待办复选框补充可访问名称（取同项文字），
 *              不使用插件自带 label 模式，避免随机 id 造成 SSR 水合不一致
 * @author TixXin
 * @since 2026-10-18
 */
import type MarkdownIt from 'markdown-it'

type Token = ReturnType<MarkdownIt['parse']>[number]

const checkboxPattern = /^<input class="task-list-item-checkbox"/

/** 拼接行内子节点的纯文本，作为复选框名称 */
function plainText(tokens: Token[]) {
  return tokens
    .map((token) => (token.type === 'text' || token.type === 'code_inline' ? token.content : ''))
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 需在 markdown-it-task-lists 之后注册 */
export function markdownTaskLabels(md: MarkdownIt) {
  md.core.ruler.push('task-list-labels', (state) => {
    for (const token of state.tokens) {
      const children = token.type === 'inline' ? token.children : null
      const checkbox = children?.find((child) => child.type === 'html_inline' && checkboxPattern.test(child.content))
      if (!children || !checkbox) continue
      // 勾选状态由复选框自身朗读，名称只取事项文字
      const label = plainText(children.slice(children.indexOf(checkbox) + 1)) || '待办事项'
      checkbox.content = checkbox.content.replace(checkboxPattern, `$& aria-label="${md.utils.escapeHtml(label)}"`)
    }
  })
}
