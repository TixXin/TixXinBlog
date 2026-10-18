/**
 * @file highlightCode.test.ts
 * @description 代码渲染安全与对比度回归：语言失败不返回原始 HTML，不同内容保持独立，注释在站点背景上可读
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { highlightCode } from '../../app/utils/highlightCode'

// 直接读取真实主题源码，避免 Vitest 的 CSS 模块替身将 SCSS raw 导入替换为空串。
const themeVariables = readFileSync(resolve(import.meta.dirname, '../../app/assets/styles/_variables.scss'), 'utf8')

/** 按 sRGB 相对亮度计算普通文字对比度，使用真实主题背景而非 Shiki 自带背景。 */
function luminance(hex: string): number {
  expect(hex).toMatch(/^#[\da-f]{6}$/i)
  return hex
    .slice(1)
    .match(/.{2}/g)!
    .map((channel) => parseInt(channel, 16) / 255)
    .map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4))
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index]!, 0)
}

describe('代码高亮注释对比度', () => {
  it.each([
    ['ts', '// 保留单行注释', '#6a737d'],
    ['ts', '/* 保留块注释\n * 保留后续行\n */', '#6a737d'],
    ['js', '// 保留脚本注释', '#6a737d'],
    ['python', '# 保留 Python 注释', '#6a737d'],
    ['html', '<!-- 保留 HTML 注释 -->', '#6a737d'],
    ['css', '/* 保留样式注释 */', '#6a737d'],
    ['sh', '# 保留命令注释', '#6a737d'],
    ['sql', '-- 保留查询注释', '#6a737d'],
  ])('%s 注释在明暗代码块背景上均达到 4.5:1：%s', async (language, code, lightCommentColor) => {
    for (const firstRender of [true, false]) {
      const html = await highlightCode(code, language)
      const doc = new DOMParser().parseFromString(html, 'text/html')
      expect(doc.querySelector('code')?.textContent).toBe(code)
      const tokens = [...doc.querySelectorAll<HTMLElement>('code span[style]')]
      expect(tokens.length).toBeGreaterThan(0)

      for (const [mode, selector, color, fallbackColor] of [
        ['light', ':root', lightCommentColor, '#24292e'],
        ['dark', '.dark', '#bdc4cc', '#f0f3f6'],
      ]) {
        // 三套布局共用此变量；直接读取源码，背景调整后仍会检验实际配色。
        const background = themeVariables.split(`${selector} {`)[1]!.match(/--surface-2:\s*(#[\da-f]{6});/i)![1]!
        for (const token of tokens) {
          const foreground = token.style.getPropertyValue(`--shiki-${mode}`).toLowerCase()
          // 首次编译语法可能耗尽 Shiki 默认分词预算而使用正文色；两条路径都必须可读。
          // 复用语法后仍严格检查注释色，避免将始终未高亮的输出误判为正常。
          if (firstRender) expect([color, fallbackColor]).toContain(foreground)
          else expect(foreground).toBe(color)
          const light = Math.max(luminance(foreground), luminance(background))
          const dark = Math.min(luminance(foreground), luminance(background))
          expect((light + 0.05) / (dark + 0.05), `${mode} ${foreground}/${background}`).toBeGreaterThanOrEqual(4.5)
        }
      }
    }
  })
})

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
