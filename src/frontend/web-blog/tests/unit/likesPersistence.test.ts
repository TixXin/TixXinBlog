/**
 * @file likesPersistence.test.ts
 * @description 本机收藏写入失败不改变显示状态，恢复存储后可继续操作
 * @author TixXin
 * @since 2026-09-07
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { useLikes } from '../../app/composables/useLikes'

const mocks = vi.hoisted(() => ({ error: vi.fn() }))
mockNuxtImport('useToast', () => () => ({ error: mocks.error }))
afterEach(() => {
  vi.restoreAllMocks()
  mocks.error.mockClear()
  localStorage.removeItem('tixxin-blog-favorites')
})

describe('本机收藏持久化', () => {
  it('保存失败保持原集合与原存储，恢复后成功更新', async () => {
    localStorage.setItem('tixxin-blog-favorites', JSON.stringify(['old']))
    let state!: ReturnType<typeof useLikes>
    const wrapper = await mountSuspended(
      defineComponent({
        setup() {
          state = useLikes()
          return () => h('div')
        },
      }),
    )
    try {
      expect(state.isFavorited('old')).toBe(true)
      const write = vi.spyOn(localStorage, 'setItem').mockImplementationOnce(() => {
        throw new DOMException('quota', 'QuotaExceededError')
      })
      expect(state.toggleFavorite('new')).toBe(false)
      expect([...state.favoritedIds.value]).toEqual(['old'])
      expect(JSON.parse(localStorage.getItem('tixxin-blog-favorites')!)).toEqual(['old'])
      expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining('收藏未保存'))
      write.mockRestore()
      expect(state.toggleFavorite('new')).toBe(true)
      expect([...state.favoritedIds.value]).toEqual(['old', 'new'])
      expect(JSON.parse(localStorage.getItem('tixxin-blog-favorites')!)).toEqual(['old', 'new'])
    } finally {
      wrapper.unmount()
    }
  })
})
