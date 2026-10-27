/** @file tabCommandPaletteCharacterization.test.ts @description 书签命令面板的渲染表征：空查询、关键词高亮与无结果三种状态的结构快照，以及鼠标经过与点击的接线，拆分区块前后必须一致 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { Ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import TabCommandPalette from '../../app/components/tab/TabCommandPalette.vue'
import type { CommandAction } from '../../app/features/tab/paletteItems'
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
      id: 'settings',
      title: '打开设置',
      icon: 'lucide:settings',
      shortcut: '⌘,',
      section: 'actions',
      run: mocks.run,
    },
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

/** 去掉 scoped 样式标记，只比较结构、属性与文字 */
const markup = (html: string) => html.replace(/ data-v-[a-f0-9]+(="")?/g, '')

describe('书签命令面板结构', () => {
  it('空查询：动作、书签、分类三组与读屏状态', async () => {
    mocks.bookmarks.bookmarks.value.push({
      id: 'emoji',
      userId: 'local',
      name: '表情站',
      url: 'https://emoji.example/',
      categoryId: 'learning',
      sortOrder: 1,
      icon: '😀',
    })
    mocks.bookmarks.categories.value.push({
      id: 'misc',
      userId: 'local',
      name: '杂项',
      icon: '',
      color: '',
      sortOrder: 1,
    })
    const wrapper = await setup()
    expect(markup(wrapper.html())).toMatchSnapshot()
  })

  it('关键词高亮与无结果', async () => {
    const wrapper = await setup()
    await wrapper.get('input').setValue('vue')
    expect(markup(wrapper.html())).toMatchSnapshot()
    await wrapper.get('input').setValue('zzzzzzzzzzzz')
    expect(markup(wrapper.html())).toMatchSnapshot()
  })

  it('鼠标经过改变当前项，点击执行并关闭，遮罩点击关闭', async () => {
    const wrapper = await setup()
    await wrapper.get('[data-id="bm-vue"]').trigger('mouseenter')
    expect(wrapper.get('[aria-current="true"]').attributes('data-id')).toBe('bm-vue')
    expect(wrapper.get('.tab-palette__item--focus').attributes('data-id')).toBe('bm-vue')
    await wrapper.get('[data-id="act-settings"]').trigger('click')
    await flushPromises()
    expect(mocks.run).toHaveBeenCalledOnce()
    expect(mocks.close).toHaveBeenCalledOnce()
    mocks.palette.paletteOpen.value = true
    await flushPromises()
    await wrapper.get('.tab-palette').trigger('click')
    expect(mocks.close).toHaveBeenCalledTimes(2)
  })
})
