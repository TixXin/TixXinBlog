/**
 * @file postRecovery.test.ts
 * @description 副本隔离、损坏数据和写入失败保护；验证长正文差异可完整重建。
 */
import { describe, expect, it } from 'vitest'
import { readPostRecoveries, recoveryPrefix, writePostRecovery } from '~/utils/postRecovery'
import { postDifference } from '~/utils/postDifference'
import type { AdminPostDraft } from '~/features/post/adminTypes'

function storage() {
  const values = new Map<string, string>()
  return {
    get length() {
      return values.size
    },
    key: (index: number) => [...values.keys()][index] ?? null,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
    removeItem: (key: string) => {
      values.delete(key)
    },
  }
}
const draft: AdminPostDraft = {
  id: 1,
  revision: 2,
  title: '恢复测试',
  summary: '',
  cover: '',
  folder: '专栏',
  category: 'tech',
  status: 'draft',
  contentRaw: '未保存正文',
  readTimeMinutes: 2,
  pinned: false,
  tags: ['标签'],
}
describe('本机恢复副本', () => {
  it('两个编辑页独立保留，账号和文章不串读', () => {
    const db = storage()
    const prefix = recoveryPrefix('owner', '1')
    writePostRecovery(db, `${prefix}one`, draft)
    writePostRecovery(db, `${prefix}two`, { ...draft, contentRaw: '另一个标签页' })
    expect(readPostRecoveries(db, prefix, '1').items).toHaveLength(2)
    expect(readPostRecoveries(db, recoveryPrefix('another', '1'), '1').items).toHaveLength(0)
    expect(readPostRecoveries(db, recoveryPrefix('owner', '2'), '2').items).toHaveLength(0)
  })
  it('跳过损坏副本但保留原数据', () => {
    const db = storage()
    const prefix = recoveryPrefix('owner', '1')
    writePostRecovery(db, `${prefix}good`, draft)
    db.setItem(`${prefix}broken`, '{broken')
    const result = readPostRecoveries(db, prefix, '1')
    expect(result.items[0]?.draft.contentRaw).toBe('未保存正文')
    expect(result.invalidCount).toBe(1)
    expect(db.getItem(`${prefix}broken`)).toBe('{broken')
  })
  it('配额失败向上传播，不破坏旧副本', () => {
    const db = storage()
    const prefix = recoveryPrefix('owner', '1')
    writePostRecovery(db, `${prefix}one`, draft)
    db.setItem = () => {
      throw new Error('quota')
    }
    expect(() => writePostRecovery(db, `${prefix}one`, { ...draft, contentRaw: '新输入' })).toThrow('quota')
    expect(readPostRecoveries(db, prefix, '1').items[0]?.draft.contentRaw).toBe('未保存正文')
  })
})
describe('正文差异', () => {
  it.each([
    ['', '新内容'],
    ['a\n', 'a'],
    ['首\n旧\n末', '首\n新\n末'],
    ['不变', '不变'],
    [Array(10000).fill('正文').join('\n'), '开头\n' + Array(10000).fill('正文').join('\n')],
  ])('可完整重建前后文本', (before, after) => {
    const diff = postDifference(before, after)
    expect([...diff.prefix, ...diff.removed, ...diff.suffix].join('\n')).toBe(before)
    expect([...diff.prefix, ...diff.added, ...diff.suffix].join('\n')).toBe(after)
  })
})
