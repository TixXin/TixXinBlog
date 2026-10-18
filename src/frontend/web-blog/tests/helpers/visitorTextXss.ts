/** @file visitorTextXss.ts @description 在解析后的 DOM 上核查访客内容，避免把安全转义的攻击原文误判为漏洞。 */
import { expect } from 'vitest'

export function expectSafeVisitorDom(root: Element) {
  const forbiddenTags = 'script, iframe, object, embed, svg, math, style, link, meta, base, form, input'
  expect(root.matches(forbiddenTags)).toBe(false)
  expect(root.querySelectorAll(forbiddenTags)).toHaveLength(0)
  for (const element of [root, ...root.querySelectorAll('*')]) {
    for (const attribute of element.attributes) {
      expect(attribute.name).not.toMatch(/^on/i)
      expect(['style', 'srcdoc', 'xlink:href', 'formaction']).not.toContain(attribute.name)
      if (['href', 'src'].includes(attribute.name)) {
        // 用 URL 解析器判断浏览器实际识别的协议；编码后仍为站内路径的文字不误判为可执行协议。
        const url = new URL(attribute.value, 'https://blog.example.test/')
        const allowed = attribute.name === 'href' ? ['http:', 'https:', 'mailto:'] : ['http:', 'https:']
        expect(allowed).toContain(url.protocol)
      }
    }
  }
  expect(root.textContent).toContain('安全正文')
}
