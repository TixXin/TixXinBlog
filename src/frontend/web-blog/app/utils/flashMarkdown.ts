/**
 * @file flashMarkdown.ts
 * @description 轻量 markdown 渲染器：仅覆盖闪念编辑器工具栏支持的子集
 *              （bold / italic / strikethrough / inline code / checkbox / quote / list）
 *              先转义 HTML 再做正则，用于 v-html 场景时 XSS 安全
 * @author TixXin
 * @since 2026-04-12
 */

/**
 * 将闪念内容中的 markdown 子集转为 HTML 字符串。
 * 支持范围：**粗体**、*斜体*、~~删除线~~、`行内代码`、- [x] 复选框、> 引用、- 列表
 */
export function renderFlashMarkdown(raw: string): string {
  // 1. 转义 HTML 实体 —— v-html 场景下必须先做，防止用户注入 <script> 等
  let html = raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

  // 2. 提取行内代码到占位符，避免代码内的 * ~ 等被后续正则误匹配
  const codeSlots: string[] = []
  html = html.replace(/`([^`]+?)`/g, (_, content: string) => {
    codeSlots.push(content)
    return `%%FMCODE${codeSlots.length - 1}%%`
  })

  // 3. 行内格式（顺序关键：先 bold 再 italic，避免 ** 被 * 截断）
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>')

  // 4. 还原行内代码
  html = html.replace(/%%FMCODE(\d+)%%/g, (_, idx: string) => {
    return `<code class="fm-code">${codeSlots[Number(idx)]}</code>`
  })

  // 5. 行级格式：逐行检测 checkbox / quote / list
  html = html
    .split('\n')
    .map((line) => {
      // 复选框（已勾选）
      if (line.startsWith('- [x] ')) {
        return `<span class="fm-checkbox fm-checkbox--checked">\u2611 ${line.slice(6)}</span>`
      }
      // 复选框（未勾选）
      if (line.startsWith('- [ ] ')) {
        return `<span class="fm-checkbox">\u2610 ${line.slice(6)}</span>`
      }
      // 引用（> 已被转义为 &gt;）
      if (line.startsWith('&gt; ')) {
        return `<span class="fm-quote">${line.slice(5)}</span>`
      }
      // 无序列表
      if (line.startsWith('- ')) {
        return `<span class="fm-li">${line.slice(2)}</span>`
      }
      return line
    })
    .join('\n')

  // 6. 换行符 → <br>
  html = html.replace(/\n/g, '<br>')

  return html
}
