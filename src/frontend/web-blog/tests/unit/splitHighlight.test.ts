/** @file splitHighlight.test.ts @description 关键词高亮切分：大小写、多次命中、空关键词与边界 */
import { describe, expect, it } from 'vitest'
import { splitHighlight } from '../../app/utils/splitHighlight'

describe('splitHighlight', () => {
  it('空关键词或仅空白时原样返回', () => {
    expect(splitHighlight('Vue 组件', '')).toEqual([{ text: 'Vue 组件', match: false }])
    expect(splitHighlight('Vue 组件', '  ')).toEqual([{ text: 'Vue 组件', match: false }])
  })

  it('忽略大小写并保留原文大小写', () => {
    expect(splitHighlight('用 vue 写的 Vue 组件', 'VUE')).toEqual([
      { text: '用 ', match: false },
      { text: 'vue', match: true },
      { text: ' 写的 ', match: false },
      { text: 'Vue', match: true },
      { text: ' 组件', match: false },
    ])
  })

  it('命中位于开头和结尾时不产生空片段', () => {
    expect(splitHighlight('留言板留言', '留言')).toEqual([
      { text: '留言', match: true },
      { text: '板', match: false },
      { text: '留言', match: true },
    ])
  })

  it('未命中时返回整段文本', () => {
    expect(splitHighlight('深色主题', 'CSS')).toEqual([{ text: '深色主题', match: false }])
  })

  it('缺省关键词、空文本与连续命中均保留完整原文', () => {
    expect(splitHighlight('原文')).toEqual([{ text: '原文', match: false }])
    expect(splitHighlight('原文', null)).toEqual([{ text: '原文', match: false }])
    expect(splitHighlight('', 'Vue')).toEqual([{ text: '', match: false }])
    expect(splitHighlight('哈哈哈哈', '哈哈')).toEqual([
      { text: '哈哈', match: true },
      { text: '哈哈', match: true },
    ])
  })

  it('去除关键词首尾空白，正则特殊字符仍按字面匹配', () => {
    const keyword = '.*+?^${}()|[]\\'
    expect(splitHighlight(`前${keyword}后`, `  ${keyword}  `)).toEqual([
      { text: '前', match: false },
      { text: keyword, match: true },
      { text: '后', match: false },
    ])
    expect(splitHighlight('ab', '.')).toEqual([{ text: 'ab', match: false }])
  })

  it('Unicode 大小写长度变化不会错位或丢字', () => {
    expect(splitHighlight('İ Vue 与 VUE', 'vue')).toEqual([
      { text: 'İ ', match: false },
      { text: 'Vue', match: true },
      { text: ' 与 ', match: false },
      { text: 'VUE', match: true },
    ])
    expect(splitHighlight('🌸花🌸', '🌸')).toEqual([
      { text: '🌸', match: true },
      { text: '花', match: false },
      { text: '🌸', match: true },
    ])
  })
})
