/**
 * @file highlightCode.test.ts
 * @description 代码渲染安全回归：语言失败不返回原始 HTML，不同内容保持独立
 */
import { describe, expect, it } from 'vitest'
import { highlightCode } from '../../app/utils/highlightCode'

describe('代码高亮安全边界', () => {
  it('未知语言返回空结果，由组件文本节点兜底', async () => {
    expect(await highlightCode('<img src=x onerror="alert(1)">', 'not-a-real-language')).toBe('')
  })

  it('合法语言中 HTML 作为代码转义，同前缀的不同内容不会混用', async () => {
    const prefix = 'const samePrefixForAudit = '
    const [first, second] = await Promise.all([
      highlightCode(prefix + '"<script>one</script>"', 'text'),
      highlightCode(prefix + '"<script>two</script>"', 'text'),
    ])
    const firstDom = new DOMParser().parseFromString(first, 'text/html')
    const secondDom = new DOMParser().parseFromString(second, 'text/html')
    expect(firstDom.querySelector('script')).toBeNull()
    expect(firstDom.querySelector('code')?.textContent).toBe(prefix + '"<script>one</script>"')
    expect(secondDom.querySelector('code')?.textContent).toBe(prefix + '"<script>two</script>"')
    expect(first).not.toEqual(second)
  })
})
