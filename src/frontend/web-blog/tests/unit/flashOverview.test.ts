/**
 * @file flashOverview.test.ts
 * @description 本地闪念概览与后端 /flashes/overview 同口径：UTC 日期与本月、标签计数排序、往年今日与访客已赞
 */
import { describe, expect, it } from 'vitest'
import { summarizeFlashNotes } from '../../app/features/flash/overview'
import type { FlashNote } from '../../app/features/flash/types'

function note(id: string, createdAt: string, tags: string[] = [], liked = false): FlashNote {
  return {
    id,
    userId: 'tixxin',
    content: `${id} 正文`.padEnd(400, '。'),
    tags,
    images: [],
    type: 'memo',
    createdAt,
    updatedAt: createdAt,
    likes: liked ? 1 : 0,
    liked,
    comments: [],
  }
}

describe('summarizeFlashNotes', () => {
  const now = new Date('2026-10-18T03:00:00.000Z')

  it('日期与本月按 UTC 分组，跨时区边界不偏移', () => {
    const result = summarizeFlashNotes(
      [
        note('a', '2026-10-17T23:30:00.000Z'),
        note('b', '2026-10-17T01:00:00.000Z'),
        note('c', '2026-09-30T23:59:59.000Z'),
        note('d', '2026-11-01T00:00:00.000Z'),
      ],
      now,
    )
    expect(result.total).toBe(4)
    expect(result.monthCount).toBe(2)
    expect(result.dates).toEqual([
      { date: '2026-11-01', count: 1 },
      { date: '2026-10-17', count: 2 },
      { date: '2026-09-30', count: 1 },
    ])
  })

  it('标签按次数倒序、同次数按名称，往年今日取最近一年，已赞编号来自列表状态', () => {
    const result = summarizeFlashNotes(
      [
        note('a', '2024-10-18T05:00:00.000Z', ['b', 'a']),
        note('b', '2025-10-18T05:00:00.000Z', ['a'], true),
        note('c', '2026-10-18T01:00:00.000Z', ['c', 'b']),
      ],
      now,
    )
    expect(result.tags).toEqual([
      { name: 'a', count: 2 },
      { name: 'b', count: 2 },
      { name: 'c', count: 1 },
    ])
    expect(result.onThisDay?.id).toBe('b')
    expect(result.onThisDay?.content).toHaveLength(300)
    expect(result.recollections.map((item) => item.id)).toEqual(['a', 'b', 'c'])
    expect(result.likedIds).toEqual(['b'])
  })

  it('空集合返回零值', () => {
    expect(summarizeFlashNotes([], now)).toEqual({
      total: 0,
      monthCount: 0,
      dates: [],
      tags: [],
      onThisDay: null,
      recollections: [],
      likedIds: [],
    })
  })
})
