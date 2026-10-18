/**
 * @file readingHistory.test.ts
 * @description 阅读历史的本机恢复、去重排序、数量上限与清理边界
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { useReadingHistory } from '../../app/composables/useReadingHistory'
import type { HistoryItem } from '../../app/composables/useReadingHistory'

const storageKey = 'blog-reading-history'
const wrappers: { unmount(): void }[] = []
const originalGetItem = localStorage.getItem

function historyItem(id: string): HistoryItem {
  return {
    id,
    title: `阅读笔记 ${id}`,
    cover: `/images/${id}.webp`,
    date: '2026-10-01',
    visitedAt: '2026-10-17T08:00:00.000Z',
  }
}

async function setup(reset = true) {
  let state!: ReturnType<typeof useReadingHistory>
  wrappers.push(
    await mountSuspended(
      defineComponent({
        setup() {
          if (reset) clearNuxtState('reading-history')
          state = useReadingHistory()
          return () => h('div')
        },
      }),
    ),
  )
  return state
}

beforeEach(() => {
  localStorage.removeItem(storageKey)
})

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.restoreAllMocks()
  // HappyDOM 的 Storage 代理隐藏方法描述符，显式恢复以避免异常 mock 泄漏到后续用例。
  Object.defineProperty(localStorage, 'getItem', { configurable: true, writable: true, value: originalGetItem })
  vi.useRealTimers()
  localStorage.removeItem(storageKey)
  localStorage.removeItem('reading-history-unrelated')
})

describe('阅读历史', () => {
  it('挂载时恢复持久记录并保留文章信息和访问时间', async () => {
    const saved = [historyItem('first'), historyItem('second')]
    localStorage.setItem(storageKey, JSON.stringify(saved))

    const state = await setup()

    expect(state.history.value).toEqual(saved)
  })

  it.each([null, '{invalid'])('缺失或损坏的持久内容 %s 恢复为空列表', async (raw) => {
    if (raw !== null) localStorage.setItem(storageKey, raw)

    const state = await setup()

    expect(state.history.value).toEqual([])
  })

  it('浏览器禁止读取时仍能挂载空历史', async () => {
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new DOMException('浏览器禁止访问存储', 'SecurityError')
    })

    const state = await setup()

    expect(state.history.value).toEqual([])
  })

  it('再次访问同一文章移至首位，更新内容与时间并持久化', async () => {
    localStorage.setItem(storageKey, JSON.stringify([historyItem('first'), historyItem('second')]))
    const state = await setup()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-18T09:30:00.000Z'))

    state.addToHistory({ id: 'second', title: '更新后的标题', date: '2026-10-18' })

    expect(state.history.value).toEqual([
      { id: 'second', title: '更新后的标题', date: '2026-10-18', visitedAt: '2026-10-18T09:30:00.000Z' },
      historyItem('first'),
    ])
    expect(JSON.parse(localStorage.getItem(storageKey)!)).toEqual(state.history.value)
  })

  it('加入第 51 条记录只保留最近 50 条，淘汰最旧一条', async () => {
    const saved = Array.from({ length: 50 }, (_, index) => historyItem(String(index)))
    localStorage.setItem(storageKey, JSON.stringify(saved))
    const state = await setup()

    state.addToHistory({ id: 'new', title: '最新阅读', date: '2026-10-18' })

    expect(state.history.value.map((item) => item.id)).toEqual(['new', ...saved.slice(0, 49).map((item) => item.id)])
    expect(JSON.parse(localStorage.getItem(storageKey)!)).toHaveLength(50)
  })

  it('多个组件共享已保存的历史变化', async () => {
    const first = await setup()
    const second = await setup(false)

    first.addToHistory({ id: 'shared', title: '跨组件阅读', date: '2026-10-18' })

    expect(second.history.value).toEqual(first.history.value)
    expect(second.history.value[0]?.id).toBe('shared')
  })

  it('清空历史同时删除对应存储项并保留其他本机数据', async () => {
    localStorage.setItem(storageKey, JSON.stringify([historyItem('first')]))
    localStorage.setItem('reading-history-unrelated', '保留')
    const state = await setup()

    state.clearHistory()

    expect(state.history.value).toEqual([])
    expect(localStorage.getItem(storageKey)).toBeNull()
    expect(localStorage.getItem('reading-history-unrelated')).toBe('保留')
  })
})
