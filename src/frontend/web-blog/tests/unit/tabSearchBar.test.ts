/** @file tabSearchBar.test.ts @description 标签页搜索栏：各搜索引擎的提示与跳转地址、网址直接打开、本地书签与分类命中下拉、方向键循环、失焦延迟收起与打开命中项 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { Ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import TabSearchBar from '../../app/components/tab/TabSearchBar.vue'
import { TAB_SETTINGS_DEFAULTS } from '../../app/composables/useTabSettings'
import type { TabSettings } from '../../app/composables/useTabSettings'
import type { Bookmark, BookmarkCategory } from '../../app/features/tab/types'

const mocks = vi.hoisted(() => ({
  settings: { value: {} } as Ref<TabSettings>,
  bookmarks: { value: [] } as Ref<Bookmark[]>,
  categories: { value: [] } as Ref<BookmarkCategory[]>,
  selectCategory: vi.fn(),
}))
mockNuxtImport('useTabSettings', () => () => ({ settings: mocks.settings }))
mockNuxtImport('useTabBookmarks', () => () => ({
  bookmarks: mocks.bookmarks,
  categories: mocks.categories,
  selectCategory: mocks.selectCategory,
}))

const wrappers: { unmount(): void }[] = []
async function mountBar() {
  const host = document.createElement('div')
  document.body.append(host)
  const wrapper = await mountSuspended(TabSearchBar, { attachTo: host, global: { stubs: { Icon: true } } })
  wrappers.push({
    unmount: () => {
      wrapper.unmount()
      host.remove()
    },
  })
  return wrapper
}
/** 去掉 scoped 样式标记，只比较结构、属性与文字 */
const markup = (html: string) => html.replace(/ data-v-[a-f0-9]+(="")?/g, '')

beforeEach(() => {
  mocks.settings = ref({ ...TAB_SETTINGS_DEFAULTS })
  mocks.bookmarks = ref([
    {
      id: 'vue',
      userId: 'local',
      name: 'Vue 文档',
      url: 'https://vuejs.org/',
      categoryId: 'dev',
      sortOrder: 0,
      icon: 'lucide:book',
    },
    {
      id: 'emoji',
      userId: 'local',
      name: 'Vite',
      url: 'https://vite.dev/',
      categoryId: 'dev',
      sortOrder: 1,
      icon: '⚡',
    },
    { id: 'plain', userId: 'local', name: 'Vitest', url: 'https://vitest.dev/', categoryId: 'dev', sortOrder: 2 },
  ])
  mocks.categories = ref([
    { id: 'dev', userId: 'local', name: 'Vue 开发', icon: 'lucide:folder', color: '', sortOrder: 0 },
  ])
  mocks.selectCategory.mockReset()
  vi.spyOn(window, 'open').mockReturnValue(null)
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.useRealTimers()
  vi.restoreAllMocks()
})

it('各搜索引擎的提示与跳转地址，网址直接打开，空白不提交', async () => {
  const wrapper = await mountBar()
  const trace: unknown[] = [markup(wrapper.html())]
  const engines: [TabSettings['searchEngine'], string][] = [
    ['google', ''],
    ['bing', ''],
    ['duckduckgo', ''],
    ['baidu', ''],
    ['custom', 'https://search.example/?q=%s&lang=zh'],
    ['custom', 'https://search.example/find/'],
  ]
  for (const [searchEngine, searchEngineCustomUrl] of engines) {
    mocks.settings.value = { ...mocks.settings.value, searchEngine, searchEngineCustomUrl }
    await wrapper.get('input').setValue('  vue 3 & nuxt ')
    await wrapper.get('form').trigger('submit')
    trace.push(wrapper.get('.tab-search__hint').text())
  }
  await wrapper.get('input').setValue('HTTPS://Example.com/a b')
  await wrapper.get('form').trigger('submit')
  await wrapper.get('input').setValue('   ')
  await wrapper.get('form').trigger('submit')
  trace.push(vi.mocked(window.open).mock.calls, wrapper.get('button[type="submit"]').attributes('disabled'))
  expect(trace).toMatchSnapshot()
})

it('本地命中下拉：最多 5 项、聚焦才显示，方向键循环，Esc 清空，失焦 180ms 后收起', async () => {
  vi.useFakeTimers()
  const wrapper = await mountBar()
  const input = wrapper.get('input')
  await input.setValue('vue')
  const trace: unknown[] = [wrapper.find('.tab-search__dropdown').exists()]
  await input.trigger('focus')
  trace.push(markup(wrapper.html()))
  await input.trigger('keydown', { key: 'ArrowDown' })
  await vi.runAllTimersAsync()
  const hits = () => wrapper.findAll('.tab-search__hit')
  trace.push(document.activeElement === hits()[0]!.element, wrapper.get('.tab-search__hit--focus').text())
  await hits()[0]!.trigger('keydown', { key: 'ArrowUp' })
  trace.push(document.activeElement === hits().at(-1)!.element)
  await hits().at(-1)!.trigger('keydown', { key: 'ArrowDown' })
  trace.push(document.activeElement === hits()[0]!.element)
  await hits()[1]!.trigger('mouseenter')
  trace.push(wrapper.get('.tab-search__hit--focus').text())
  await input.trigger('blur')
  await vi.advanceTimersByTimeAsync(179)
  trace.push(wrapper.find('.tab-search__dropdown').exists())
  await input.trigger('focus')
  await vi.advanceTimersByTimeAsync(400)
  trace.push(wrapper.find('.tab-search__dropdown').exists())
  await input.trigger('blur')
  await vi.advanceTimersByTimeAsync(180)
  trace.push(wrapper.find('.tab-search__dropdown').exists(), wrapper.find('.tab-search__hit--focus').exists())
  await input.trigger('focus')
  await hits()[0]!.trigger('keydown', { key: 'Escape' })
  trace.push((input.element as HTMLInputElement).value, wrapper.find('.tab-search__clear').exists())
  expect(trace).toMatchSnapshot()
})

it('打开命中项：书签新窗口打开、分类切换，随后清空并收起；清除按钮清空', async () => {
  const wrapper = await mountBar()
  const input = wrapper.get('input')
  await input.setValue('vitest')
  await input.trigger('focus')
  await wrapper.findAll('.tab-search__hit')[0]!.trigger('click')
  const afterBookmark = [(input.element as HTMLInputElement).value, wrapper.find('.tab-search__dropdown').exists()]
  await input.setValue('开发')
  await input.trigger('focus')
  const category = wrapper.findAll('.tab-search__hit').find((hit) => hit.text().includes('Vue 开发'))!
  await category.trigger('keydown', { key: 'Enter' })
  await input.setValue('abc')
  await wrapper.get('.tab-search__clear').trigger('click')
  expect({
    afterBookmark,
    opened: vi.mocked(window.open).mock.calls,
    selected: mocks.selectCategory.mock.calls,
    cleared: (input.element as HTMLInputElement).value,
  }).toMatchSnapshot()
})
