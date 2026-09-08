/**
 * @file localPersistence.test.ts
 * @description 存储异常回归：失败不伪装成功、多键原值恢复及异常中断恢复
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { recoverLocalBatch, writeLocalBatch, writeLocalJson } from '../../app/utils/localPersistence'

beforeEach(() => {
  const data = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value)
    },
    removeItem: (key: string) => {
      data.delete(key)
    },
    clear: () => data.clear(),
  })
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('本地持久化', () => {
  it('容量错误向调用方传播，不宣称保存成功', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    expect(() => writeLocalJson('test', { content: '未保存内容' })).toThrow('尚未保存')
  })

  it('第二个写入失败后恢复两个键的原值', () => {
    const categories = 'tab:categories:test'
    const bookmarks = 'tab:bookmarks:test'
    localStorage.setItem(categories, '["old-category"]')
    localStorage.setItem(bookmarks, '["old-bookmark"]')
    const original = localStorage.setItem.bind(localStorage)
    vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      if (key === bookmarks && value === '["new-bookmark"]') throw new Error('quota')
      original(key, value)
    })
    expect(() =>
      writeLocalBatch([
        [categories, ['new-category']],
        [bookmarks, ['new-bookmark']],
      ]),
    ).toThrow('尚未保存')
    expect(localStorage.getItem(categories)).toBe('["old-category"]')
    expect(localStorage.getItem(bookmarks)).toBe('["old-bookmark"]')
  })

  it('异常中断的导入在下一次读取前恢复备份', () => {
    localStorage.setItem('tab:categories:test', '["partial-new"]')
    localStorage.setItem(
      'tixxin-local-write-backup',
      JSON.stringify([
        ['tab:categories:test', '["old"]'],
        ['tab:bookmarks:test', null],
      ]),
    )
    recoverLocalBatch()
    expect(localStorage.getItem('tab:categories:test')).toBe('["old"]')
    expect(localStorage.getItem('tixxin-local-write-backup')).toBeNull()
  })
})
