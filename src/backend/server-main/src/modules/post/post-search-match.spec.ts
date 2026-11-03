/** @file post-search-match.spec.ts @description 正文命中窗口：大小写、中文、首尾边界与代理对完整性 */
import { CONTENT_MATCH_AFTER, CONTENT_MATCH_BEFORE, contentMatchWindow } from './post-search-match'

describe('正文命中窗口', () => {
  it('不区分大小写定位首个命中，返回原文片段', () => {
    expect(contentMatchWindow('Intro: Nuxt static PUBLISH guide', 'publish')).toBe('Intro: Nuxt static PUBLISH guide')
  })

  it('中文命中按前后字符数截取', () => {
    const raw = '前'.repeat(200) + '关键词' + '后'.repeat(300)
    const window = contentMatchWindow(raw, '关键词')!
    expect(window).toBe('前'.repeat(CONTENT_MATCH_BEFORE) + '关键词' + '后'.repeat(CONTENT_MATCH_AFTER))
  })

  it('命中靠近开头或结尾时窗口贴边，不越界', () => {
    expect(contentMatchWindow('关键词' + '后'.repeat(10), '关键词')).toBe('关键词' + '后'.repeat(10))
    const tail = '前'.repeat(300) + '关键词'
    expect(contentMatchWindow(tail, '关键词')).toBe('前'.repeat(CONTENT_MATCH_BEFORE) + '关键词')
  })

  it('窗口边界落在代理对中间时向外扩展，不产生孤立代理项', () => {
    const emoji = '😀'
    // 命中位于 83：起点 3 与终点 246 都恰好落在表情的低位代理上
    const raw = emoji.repeat(41) + 'a' + '关键词' + 'b' + emoji.repeat(100)
    const window = contentMatchWindow(raw, '关键词')!
    expect(raw.charCodeAt(83 - CONTENT_MATCH_BEFORE)).toBeGreaterThanOrEqual(0xdc00)
    expect(raw.charCodeAt(83 + 3 + CONTENT_MATCH_AFTER)).toBeGreaterThanOrEqual(0xdc00)
    expect(window).toBe(raw.slice(83 - CONTENT_MATCH_BEFORE - 1, 83 + 3 + CONTENT_MATCH_AFTER + 1))
    expect(window.startsWith(emoji)).toBe(true)
    expect(window.endsWith(emoji)).toBe(true)
  })

  it('小写后长度变化的字符仍按原文下标截取', () => {
    expect(contentMatchWindow('İstanbul 指南', '指南')).toBe('İstanbul 指南')
  })

  it.each([
    ['正文未命中', '没有关键词', '其他'],
    ['正文为空', '', '关键词'],
    ['关键词为空白', '正文', '  '],
  ])('%s时返回 undefined', (_, raw, keyword) => {
    expect(contentMatchWindow(raw, keyword)).toBeUndefined()
  })
})
