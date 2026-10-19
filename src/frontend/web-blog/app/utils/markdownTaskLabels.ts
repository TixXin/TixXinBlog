/**
 * @file markdownTaskLabels.ts
 * @description markdown-it 插件：为 markdown-it-task-lists 输出的待办复选框补充可访问名称（取同项文字），
 *              不使用插件自带 label 模式，避免随机 id 造成 SSR 水合不一致；
 *              无文字时的兜底名称取渲染环境 markdownLinks.t 按界面语言翻译，未传时保持中文
 * @author TixXin
 * @since 2026-10-18
 */
import type { MarkdownIt, Token } from 'markdown-it'
import type { MarkdownLinkEnvironment } from '~/utils/markdownLinks'
import type { MarkdownTranslate } from '~/utils/markdownLabels'

const checkboxPattern = /^<input class="task-list-item-checkbox"/

/** 兜底名称的字典 key 与中文；中文与 zh-CN 字典 flash-moment.markdown.taskItem 逐字一致，由单测校验 */
export const TASK_ITEM_LABEL_KEY = 'flash-moment.markdown.taskItem'
export const TASK_ITEM_FALLBACK_LABEL = '待办事项'

/** 渲染时求值，不在模块顶层固定语言；没有翻译函数或翻译结果仍是 key 时回退中文 */
function taskItemLabel(t?: MarkdownTranslate) {
  const text = t?.(TASK_ITEM_LABEL_KEY)
  return text && text !== TASK_ITEM_LABEL_KEY ? text : TASK_ITEM_FALLBACK_LABEL
}

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
    const t = (state.env as MarkdownLinkEnvironment | undefined)?.markdownLinks?.t
    for (const token of state.tokens) {
      const children = token.type === 'inline' ? token.children : null
      const checkbox = children?.find((child) => child.type === 'html_inline' && checkboxPattern.test(child.content))
      if (!children || !checkbox) continue
      // 勾选状态由复选框自身朗读，名称只取事项文字
      const label = plainText(children.slice(children.indexOf(checkbox) + 1)) || taskItemLabel(t)
      checkbox.content = checkbox.content.replace(checkboxPattern, `$& aria-label="${md.utils.escapeHtml(label)}"`)
    }
  })
}
