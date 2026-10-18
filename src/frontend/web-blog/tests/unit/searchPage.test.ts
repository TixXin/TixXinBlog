/** @file searchPage.test.ts @description 搜索页关键词高亮、分组链接键盘导航与查询更新边界。 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, nextTick, reactive, ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { useRouter } from '#app'
import SearchPage from '../../app/pages/search.vue'
import type { SearchGroup } from '../../app/features/search/types'

const mocks = vi.hoisted(() => ({
  search: vi.fn(),
  cancel: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
}))
const route = reactive({ path: '/search', fullPath: '/search?q=vue', query: { q: 'vue', type: 'all', page: '1' } })
const groups = ref<SearchGroup[]>([])
const isSearching = ref(false)
const error = ref('')

mockNuxtImport('useRoute', () => () => route)
mockNuxtImport('useSearch', () => () => ({
  groups,
  total: computed(() => groups.value.reduce((sum, group) => sum + (group.total ?? 0), 0)),
  isSearching,
  error,
  search: mocks.search,
  cancel: mocks.cancel,
}))
mockNuxtImport('usePageSeo', () => () => {})

const wrappers: { unmount(): void }[] = []
const NuxtLink = defineComponent({
  props: ['to'],
  setup:
    (props, { slots }) =>
    () =>
      h('a', { href: typeof props.to === 'string' ? props.to : props.to.path }, slots.default?.()),
})

async function setup() {
  const wrapper = await mountSuspended(SearchPage, {
    attachTo: document.body,
    global: {
      stubs: {
        CommonPageFrame: { template: '<main><slot name="header" /><slot /></main>' },
        CommonPageHeader: true,
        CommonCustomScrollbar: { template: '<div><slot /></div>' },
        CommonRequestFeedback: true,
        Icon: true,
        NuxtLink,
      },
    },
  })
  wrappers.push(wrapper)
  return wrapper
}

function press(target: Element, key: string, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
  target.dispatchEvent(event)
  return event
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(useRouter(), 'push').mockImplementation((to) => {
    mocks.push(to)
    return Promise.resolve()
  })
  vi.spyOn(useRouter(), 'replace').mockImplementation((to) => {
    mocks.replace(to)
    return Promise.resolve()
  })
  vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {})
  route.path = '/search'
  route.fullPath = '/search?q=vue'
  route.query = { q: 'vue', type: 'all', page: '1' }
  groups.value = [
    {
      type: 'post',
      total: 1,
      unavailable: false,
      items: [
        {
          type: 'post',
          id: 'same-id',
          title: 'Vue 与 VUE <img src=x>',
          description: '使用 vue 写组件 <script>alert(1)</script>',
          url: '/posts/vue',
          icon: 'lucide:file-text',
        },
      ],
    },
    { type: 'project', total: null, unavailable: true, items: [] },
    {
      type: 'link',
      total: 1,
      unavailable: false,
      items: [
        {
          type: 'link',
          id: 'same-id',
          title: 'Vue 文档',
          description: '阅读 Vue 文档',
          url: 'https://vuejs.org',
          icon: 'lucide:link',
        },
      ],
    },
  ]
  isSearching.value = false
  error.value = ''
  mocks.search.mockResolvedValue(undefined)
})

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.restoreAllMocks()
})

it('按已提交关键词高亮标题及摘要，保留原文、失败分组和外链属性', async () => {
  const wrapper = await setup()
  expect(mocks.search).toHaveBeenCalledWith('vue', 'all', 1)
  expect(wrapper.findAll('mark').map((mark) => mark.text())).toEqual(['Vue', 'VUE', 'vue', 'Vue', 'Vue'])
  expect(wrapper.text()).toContain('<img src=x>')
  expect(wrapper.text()).toContain('<script>alert(1)</script>')
  expect(wrapper.find('img').exists()).toBe(false)
  expect(wrapper.find('script').exists()).toBe(false)
  expect(wrapper.text()).toContain('此来源暂不可用')
  const links = wrapper.findAll('a[data-search-result]')
  expect(links[0]?.attributes('href')).toBe('/posts/vue')
  expect(links[1]?.attributes('target')).toBe('_blank')
  expect(links[1]?.attributes('rel')).toBe('noopener noreferrer')
  await wrapper.get('input').setValue('文档')
  expect(wrapper.findAll('mark').map((mark) => mark.text())).toEqual(['Vue', 'VUE', 'vue', 'Vue', 'Vue'])
})

it('搜索框方向键进入结果，跨分组循环移动真实焦点，Enter 保留链接原生打开行为', async () => {
  const wrapper = await setup()
  const input = wrapper.get('input').element
  const links = wrapper.findAll('a[data-search-result]').map((link) => link.element)
  input.focus()
  expect(press(input, 'ArrowDown').defaultPrevented).toBe(true)
  expect(document.activeElement).toBe(links[0])
  press(links[0]!, 'ArrowDown')
  expect(document.activeElement).toBe(links[1])
  press(links[1]!, 'ArrowDown')
  expect(document.activeElement).toBe(links[0])
  press(links[0]!, 'ArrowUp')
  expect(document.activeElement).toBe(links[1])
  input.focus()
  press(input, 'ArrowUp')
  expect(document.activeElement).toBe(links[1])
  // 原生链接的 Enter 与修饰键由浏览器处理，不改写为另一条路由跳转路径。
  expect(press(links[1]!, 'Enter').defaultPrevented).toBe(false)
  expect(press(links[1]!, 'Enter', { metaKey: true }).defaultPrevented).toBe(false)
  expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', behavior: 'instant' })
  expect(wrapper.get('input').attributes('aria-describedby')).toBe(
    wrapper.get('.search-page__keyboard').attributes('id'),
  )
})

it('输入法、组合键、未提交新关键词与加载期间均不跳入旧结果', async () => {
  const wrapper = await setup()
  const input = wrapper.get('input').element
  input.focus()
  expect(press(input, 'ArrowDown', { isComposing: true }).defaultPrevented).toBe(false)
  expect(press(input, 'ArrowDown', { keyCode: 229 }).defaultPrevented).toBe(false)
  expect(press(input, 'ArrowUp', { ctrlKey: true }).defaultPrevented).toBe(false)
  expect(document.activeElement).toBe(input)
  await wrapper.get('input').setValue('新关键词')
  expect(press(input, 'ArrowDown').defaultPrevented).toBe(false)
  expect(document.activeElement).toBe(input)
  await wrapper.get('input').setValue('vue')
  isSearching.value = true
  await nextTick()
  expect(wrapper.findAll('a[data-search-result]')).toHaveLength(0)
  expect(press(input, 'ArrowDown').defaultPrevented).toBe(false)
})

it('路由查询改变时刷新高亮并归还结果焦点，空结果不阻止输入框方向键', async () => {
  const wrapper = await setup()
  const input = wrapper.get('input').element
  press(input, 'ArrowDown')
  route.query = { q: '文档', type: 'link', page: '2' }
  route.fullPath = '/search?q=文档&type=link&page=2'
  await nextTick()
  expect(document.activeElement).toBe(input)
  expect(mocks.search).toHaveBeenLastCalledWith('文档', 'link', 2)
  expect(wrapper.findAll('mark').map((mark) => mark.text())).toEqual(['文档', '文档'])
  groups.value = []
  await nextTick()
  expect(press(input, 'ArrowUp').defaultPrevented).toBe(false)
  expect(document.activeElement).toBe(input)
})

it('搜索框未进入结果时 Enter 仍通过表单提交关键词', async () => {
  const wrapper = await setup()
  await wrapper.get('input').setValue('Nuxt')
  await wrapper.get('form').trigger('submit')
  expect(mocks.push).toHaveBeenCalledWith({ path: '/search', query: { q: 'Nuxt' } })
})
