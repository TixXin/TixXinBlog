/**
 * @file markdownPlainText.test.ts
 * @description 侧栏摘要的 Markdown 纯文本转换
 */
import { describe, expect, it } from 'vitest'
import { markdownPlainText } from '~/utils/markdownPlainText'

describe('markdownPlainText', () => {
  it('去掉任务框、列表、标题、引用与强调标记，保留文字', () => {
    const content = '## 周末清单\n- [x] 晒被子\n- [ ] 买**咖啡豆**\n1. 去_公园_散步\n> 记得带伞'
    expect(markdownPlainText(content)).toBe('周末清单 晒被子 买咖啡豆 去公园散步 记得带伞')
  })

  it('链接与图片保留可读文字，代码块整体移除，行内代码保留内容', () => {
    const content =
      '看了 [这篇文章](https://example.com/a) ![山景](/m/1.webp)\n```js\nconst a = 1\n```\n用 `pnpm dev` 启动'
    expect(markdownPlainText(content)).toBe('看了 这篇文章 山景 用 pnpm dev 启动')
  })

  it('不误删普通文字中的符号与变量名下划线', () => {
    expect(markdownPlainText('3 * 4 = 12，变量 snake_case_name 不变')).toBe('3 * 4 = 12，变量 snake_case_name 不变')
  })
})
