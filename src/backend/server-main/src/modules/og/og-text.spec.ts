/** @file og-text.spec.ts @description 分享卡片文字整理：Markdown 转纯文本、截断、标记转义、首字母与日期 */
import { avatarInitial, cardDate, cleanText, escapeMarkup, markdownToPlain, truncateText } from './og-text'

describe('分享卡片文字整理', () => {
  it('Markdown 转纯文本：保留链接文字与代码内容，丢弃图片、地址和语法符号', () => {
    const markdown = [
      '# 标题',
      '> 引用的**重点**',
      '- [x] 完成 [静态发布](https://example.com/static) 的 `搜索`',
      '![封面](/api/v1/media/a.webp)',
      '```ts',
      'const a = 1',
      '```',
      '<b>粗体</b> 与 _斜体_',
    ].join('\n')
    expect(markdownToPlain(markdown)).toBe('标题 引用的重点 完成 静态发布 的 搜索 const a = 1 粗体 与 斜体')
  })

  it('控制字符与零宽字符替换为空格并折叠', () => {
    expect(cleanText('第一行\n第二行\u200b\u0007  结尾\ufeff')).toBe('第一行 第二行 结尾')
  })

  it('按码位截断并补省略号，未超出时原样返回', () => {
    expect(truncateText('一二三四五', 3)).toBe('一二三…')
    expect(truncateText('😀😀😀', 2)).toBe('😀😀…')
    expect(truncateText('短', 3)).toBe('短')
  })

  it('转义 Pango 标记字符，防止标题被解析成标记', () => {
    expect(escapeMarkup(`<span foreground="red">A & B's</span>`)).toBe(
      '&lt;span foreground=&quot;red&quot;&gt;A &amp; B&#39;s&lt;/span&gt;',
    )
  })

  it.each([
    ['tixxin', 'T'],
    ['  博主', '博'],
    ['😀 Smile', '😀'],
    ['', 'T'],
  ])('首字母头像 %j → %s', (name, expected) => {
    expect(avatarInitial(name)).toBe(expected)
  })

  it('日期按 YYYY-MM-DD 输出，非法或缺失时返回 undefined', () => {
    const date = new Date(2026, 10, 3, 9, 30)
    expect(cardDate(date)).toBe('2026-11-03')
    expect(cardDate(date.toISOString())).toBe('2026-11-03')
    expect(cardDate('not-a-date')).toBeUndefined()
    expect(cardDate(undefined)).toBeUndefined()
  })
})
