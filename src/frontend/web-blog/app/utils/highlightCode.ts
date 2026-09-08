/**
 * @file highlightCode.ts
 * @description 代码高亮的安全边界：仅返回高亮器结果，失败交由组件使用文本节点兜底
 */
import { codeToHtml } from 'shiki'

export async function highlightCode(code: string, language = 'text'): Promise<string> {
  try {
    return await codeToHtml(code, {
      lang: language,
      themes: { light: 'github-light', dark: 'github-dark' },
    })
  } catch {
    return ''
  }
}
