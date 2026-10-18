/** @file tabCommandPalette.test.ts @description 书签命令面板的安全高亮、分组键盘顺序与命令执行回归。 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import type { Ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import TabCommandPalette from '../../app/components/tab/TabCommandPalette.vue'
import type { CommandAction } from '../../app/components/tab/TabCommandPalette.vue'
import type { Bookmark, BookmarkCategory } from '../../app/features/tab/types'

const mocks = vi.hoisted(() => ({
  palette: {} as { paletteOpen: Ref<boolean>; close: () => void },
  bookmarks: {} as {
    bookmarks: Ref<Bookmark[]>
    categories: Ref<BookmarkCategory[]>
    selectCategory: (id: string) => void
  },
  close: vi.fn(),
  selectCategory: vi.fn(),
  run: vi.fn(),
}))
mockNuxtImport('useTabCommandPalette', () => () => mocks.palette)
mockNuxtImport('useTabBookmarks', () => () => mocks.bookmarks)
// 隔离共享焦点栈，直接验证面板内的键盘状态与按钮焦点。
mockNuxtImport('useModalFocus', () => () => ({ isTopModal: () => true }))

const cleanups: (() => void)[] = []

function actions(): CommandAction[] {
  return [
    {
      id: 'open',
      title: '打开 Vue <img src=x onerror=alert(1)>',
      subtitle: 'Vue <svg onload=alert(1)> 命令',
      icon: 'lucide:search',
      section: 'actions',
      run: mocks.run,
    },
  ]
}

beforeEach(() => {
  mocks.palette = { paletteOpen: ref(true), close: mocks.close }
  mocks.close.mockReset().mockImplementation(() => {
    mocks.palette.paletteOpen.value = false
  })
  mocks.selectCategory.mockReset()
  mocks.run.mockReset().mockResolvedValue(undefined)
  mocks.bookmarks = {
    bookmarks: ref([
      {
        id: 'vue',
        userId: 'local',
        name: 'Vue',
        url: 'https://vue.example/',
        categoryId: 'learning',
        sortOrder: 0,
      },
    ]),
    categories: ref([
      { id: 'learning', userId: 'local', name: 'Vue 学习', icon: 'lucide:folder', color: '', sortOrder: 0 },
    ]),
    selectCategory: mocks.selectCategory,
  }
  vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {})
  vi.spyOn(window, 'open').mockReturnValue(null)
})

afterEach(() => {
  cleanups
    .splice(0)
    .reverse()
    .forEach((cleanup) => cleanup())
  vi.restoreAllMocks()
})

async function setup(items = actions()) {
  const host = document.createElement('div')
  document.body.append(host)
  const wrapper = await mountSuspended(TabCommandPalette, {
    props: { actions: items },
    attachTo: host,
    global: { stubs: { Teleport: true, Icon: true } },
  })
  cleanups.push(() => {
    wrapper.unmount()
    host.remove()
  })
  await flushPromises()
  return wrapper
}

describe('书签命令面板', () => {
  it('按关键词高亮标题与摘要，HTML 片段保持为文本节点', async () => {
    const wrapper = await setup()
    expect(wrapper.find('mark').exists()).toBe(false)
    await wrapper.get('input').setValue('vUe')

    const action = wrapper.get('[data-id="act-open"]')
    expect(action.get('.tab-palette__item-title').text()).toBe(actions()[0]!.title)
    expect(action.get('.tab-palette__item-sub').text()).toBe(actions()[0]!.subtitle)
    expect(action.findAll('mark').map((mark) => mark.text())).toEqual(['Vue', 'Vue'])
    expect(wrapper.get('[data-id="bm-vue"] .tab-palette__item-sub mark').text()).toBe('vue')
    expect(wrapper.find('img, svg, script').exists()).toBe(false)
  })

  it('按实际分组显示顺序选中首项并跨组循环，读屏状态同步当前项', async () => {
    const wrapper = await setup()
    const input = wrapper.get('input')
    await input.setValue('Vue')
    expect(wrapper.findAll('.tab-palette__item').map((item) => item.attributes('data-id'))).toEqual([
      'act-open',
      'bm-vue',
      'cat-learning',
    ])
    expect(wrapper.get('[aria-current="true"]').attributes('data-id')).toBe('act-open')

    for (const id of ['bm-vue', 'cat-learning', 'act-open']) {
      await input.trigger('keydown', { key: 'ArrowDown' })
      expect(wrapper.get('[aria-current="true"]').attributes('data-id')).toBe(id)
    }
    await input.trigger('keydown', { key: 'ArrowUp' })
    expect(wrapper.get('[aria-current="true"]').attributes('data-id')).toBe('cat-learning')
    expect(wrapper.get('[role="status"]').text()).toBe('已选择第 3 项，共 3 项：Vue 学习')
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenLastCalledWith({ block: 'nearest', behavior: 'instant' })
    expect(document.activeElement).toBe(input.element)
  })

  it.each([
    ['动作', 0],
    ['书签', 1],
    ['分类', 2],
  ] as const)('首次打开后可用 Enter 执行%s', async (kind, moves) => {
    const wrapper = await setup()
    const input = wrapper.get('input')
    for (let step = 0; step < moves; step++) await input.trigger('keydown', { key: 'ArrowDown' })
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(mocks.run).toHaveBeenCalledTimes(kind === '动作' ? 1 : 0)
    expect(window.open).toHaveBeenCalledTimes(kind === '书签' ? 1 : 0)
    if (kind === '书签') expect(window.open).toHaveBeenCalledWith('https://vue.example/', '_blank', 'noopener')
    expect(mocks.selectCategory).toHaveBeenCalledTimes(kind === '分类' ? 1 : 0)
    if (kind === '分类') expect(mocks.selectCategory).toHaveBeenCalledWith('learning')
    expect(mocks.close).toHaveBeenCalledOnce()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })

  it('Tab 聚焦结果后方向键移动真实焦点，Enter 执行聚焦项', async () => {
    const wrapper = await setup()
    const bookmark = wrapper.get<HTMLButtonElement>('[data-id="bm-vue"]')
    bookmark.element.focus()
    await nextTick()
    expect(wrapper.get('[aria-current="true"]').attributes('data-id')).toBe('bm-vue')
    await bookmark.trigger('keydown', { key: 'ArrowDown' })
    const category = wrapper.get<HTMLButtonElement>('[data-id="cat-learning"]')
    expect(document.activeElement).toBe(category.element)

    // 鼠标经过其他项不能改变已聚焦按钮的 Enter 目标。
    await wrapper.get('[data-id="act-open"]').trigger('mouseenter')
    await category.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(mocks.selectCategory).toHaveBeenCalledWith('learning')
    expect(mocks.run).not.toHaveBeenCalled()
    expect(mocks.close).toHaveBeenCalledOnce()
  })

  it('关闭重开恢复空查询和首项，结果更新后不会保留失效选择', async () => {
    const wrapper = await setup()
    await wrapper.get('input').setValue('example')
    expect(wrapper.get('[aria-current="true"]').attributes('data-id')).toBe('bm-vue')
    await wrapper.get('input').trigger('keydown', { key: 'Escape' })
    mocks.palette.paletteOpen.value = true
    await flushPromises()
    expect(wrapper.get<HTMLInputElement>('input').element.value).toBe('')
    expect(wrapper.get('[aria-current="true"]').attributes('data-id')).toBe('act-open')

    await wrapper.get('input').trigger('keydown', { key: 'ArrowDown' })
    mocks.bookmarks.bookmarks.value = []
    await nextTick()
    expect(wrapper.get('[aria-current="true"]').attributes('data-id')).toBe('act-open')
    await wrapper.get('input').trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(mocks.run).toHaveBeenCalledOnce()
  })

  it('空结果时方向键与 Enter 不执行，重新出现单项后上下键均可用', async () => {
    const wrapper = await setup()
    const input = wrapper.get('input')
    await input.setValue('zzzzzzzzzzzz')
    for (const key of ['ArrowDown', 'ArrowUp', 'Enter']) await input.trigger('keydown', { key })
    expect(wrapper.get('[role="status"]').text()).toBe('无匹配结果')
    expect(mocks.run).not.toHaveBeenCalled()
    expect(window.open).not.toHaveBeenCalled()
    expect(mocks.close).not.toHaveBeenCalled()

    await input.setValue('example')
    for (const key of ['ArrowUp', 'ArrowDown']) {
      await input.trigger('keydown', { key })
      expect(wrapper.get('[aria-current="true"]').attributes('data-id')).toBe('bm-vue')
    }
    await input.setValue('zzzzzzzzzzzz')
    await input.trigger('keydown', { key: 'Escape' })
    expect(mocks.close).toHaveBeenCalledOnce()
  })

  it('中文输入合成与兼容键码不触发导航或执行，关闭按钮保留原生 Enter 行为', async () => {
    const wrapper = await setup()
    const input = wrapper.get('input')
    for (const key of ['ArrowDown', 'ArrowUp', 'Enter']) {
      await input.trigger('keydown', { key, isComposing: true })
      await input.trigger('keydown', { key, keyCode: 229 })
    }
    expect(wrapper.get('[aria-current="true"]').attributes('data-id')).toBe('act-open')
    expect(mocks.run).not.toHaveBeenCalled()
    const close = wrapper.get('.tab-palette__close')
    await close.trigger('keydown', { key: 'Enter' })
    expect(mocks.run).not.toHaveBeenCalled()
    // DOM 模拟器不生成原生键盘 click，显式派发浏览器会执行的激活事件。
    await close.trigger('click')
    expect(mocks.close).toHaveBeenCalledOnce()
  })
})
