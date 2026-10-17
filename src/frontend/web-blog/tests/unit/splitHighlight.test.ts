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
})
