/**
 * @file sidebarReadingHistory.test.ts
 * @description 最近阅读卡片的空数据、存储读取失败、列表上限和键盘入口回归
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import ReadingHistoryCard from '../../app/components/sidebar/ReadingHistoryCard.vue'
import type { HistoryItem } from '../../app/composables/useReadingHistory'

const storageKey = 'blog-reading-history'
const wrappers: { unmount(): void }[] = []
const hosts: HTMLElement[] = []
const history: HistoryItem[] = Array.from({ length: 7 }, (_, index) => ({
  id: `reading-${index + 1}`,
  title: `山间行记 ${index + 1}`,
  date: `2026-10-${String(18 - index).padStart(2, '0')}`,
  visitedAt: `2026-10-${String(18 - index).padStart(2, '0')}T01:00:00Z`,
}))

beforeEach(() => localStorage.removeItem(storageKey))
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  hosts.splice(0).forEach((host) => host.remove())
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  localStorage.removeItem(storageKey)
})

async function setup() {
  const host = document.createElement('div')
  document.body.append(host)
  hosts.push(host)
  const wrapper = mount(
    defineComponent({
      setup() {
        clearNuxtState('reading-history')
        return () => h(ReadingHistoryCard)
      },
    }),
    {
      attachTo: host,
      global: {
        stubs: {
          Icon: true,
          NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
        },
      },
    },
  )
  wrappers.push(wrapper)
  await nextTick()
  return wrapper
}

describe('最近阅读侧栏卡片', () => {
  it.each([undefined, '[]', '{invalid-json'])('无记录或损坏的存储 %s 不渲染卡片和伪造内容', async (raw) => {
    if (raw !== undefined) localStorage.setItem(storageKey, raw)
    const wrapper = await setup()
    expect(wrapper.find('section').exists()).toBe(false)
    expect(wrapper.findAll('a, button')).toHaveLength(0)
  })

  it('浏览器拒绝读取存储时保持空卡片，不影响挂载', async () => {
    // 替换测试全局而非代理存储对象的方法，确保拒绝读取的模拟能完整恢复。
    const getItem = vi.fn(() => {
      throw new DOMException('存储不可用', 'SecurityError')
    })
    vi.stubGlobal('localStorage', { getItem })
    const wrapper = await setup()
    expect(wrapper.find('section').exists()).toBe(false)
    expect(getItem).toHaveBeenCalledWith(storageKey)
  })

  it('只展示最近五条，保留顺序、文章地址、日期和键盘可聚焦链接', async () => {
    localStorage.setItem(storageKey, JSON.stringify(history))
    const wrapper = await setup()
    const links = wrapper.findAll('a')
    expect(links).toHaveLength(5)
    links.forEach((link, index) => {
      expect(link.attributes('href')).toBe(`/articles/${history[index]!.id}`)
      expect(link.text()).toContain(history[index]!.title)
      expect(link.text()).toContain(history[index]!.date)
      expect(link.element.tabIndex).toBe(0)
      link.element.focus()
      expect(document.activeElement).toBe(link.element)
    })
    expect(wrapper.text()).not.toContain(history[5]!.title)
    expect(JSON.parse(localStorage.getItem(storageKey)!)).toHaveLength(7)
  })

  it('清除入口有可访问名称且可聚焦，激活后同时清除列表和持久记录', async () => {
    localStorage.setItem(storageKey, JSON.stringify(history))
    const wrapper = await setup()
    const clear = wrapper.get<HTMLButtonElement>('button[aria-label="清除阅读历史"]')
    expect(clear.attributes('type')).toBe('button')
    expect(clear.element.tabIndex).toBe(0)
    clear.element.focus()
    expect(document.activeElement).toBe(clear.element)
    // 原生按钮的 Enter/空格激活由浏览器产生 click；这里验证组件收到激活后的业务结果。
    await clear.trigger('click')
    expect(wrapper.find('section').exists()).toBe(false)
    expect(localStorage.getItem(storageKey)).toBeNull()
  })
})
