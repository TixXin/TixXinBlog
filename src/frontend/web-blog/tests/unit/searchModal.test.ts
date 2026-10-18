/** @file searchModal.test.ts @description 搜索弹窗的安全高亮、跨组键盘选择与刷新边界回归 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { useRouter } from '#app'
import SearchModal from '../../app/components/common/SearchModal.vue'
import type { useSearch } from '../../app/composables/useSearch'
import type { SearchGroup, SearchScope } from '../../app/features/search/types'

const mocks = vi.hoisted(() => ({
  state: null as unknown as ReturnType<typeof useSearch>,
  notifyError: vi.fn(),
}))
mockNuxtImport('useSearch', () => () => mocks.state)
mockNuxtImport('useAppearanceSettings', () => () => ({ contentTransitionDuration: ref(0) }))
mockNuxtImport('useToast', () => () => ({ error: mocks.notifyError }))
// 隔离模态焦点约束，专门核验结果导航对输入框和链接的焦点移动。
mockNuxtImport('useModalFocus', () => () => {})

const wrappers: { unmount(): void }[] = []
const hosts: HTMLElement[] = []

function resultGroups(): SearchGroup[] {
  return [
    {
      type: 'post',
      total: 2,
      unavailable: false,
      items: [
        {
          type: 'post',
          id: 'first',
          title: 'Vue <img src=x onerror=alert(1)> 与 vue',
          description: '<script>alert(1)</script> VUE 摘要',
          url: '/posts/first',
          icon: 'lucide:file-text',
        },
        {
          type: 'post',
          id: 'second',
          title: 'Vue 第二篇文章',
          description: '第二篇摘要',
          url: '/posts/second',
          icon: 'lucide:file-text',
        },
      ],
    },
    {
      type: 'project',
      total: 1,
      unavailable: false,
      items: [
        {
          type: 'project',
          id: 'project',
          title: 'Vue 项目',
          description: '项目中的 Vue 实践',
          url: '/projects?project=project',
          icon: 'lucide:layers',
        },
      ],
    },
    {
      type: 'link',
      total: 1,
      unavailable: false,
      items: [
        {
          type: 'link',
          id: 'link',
          title: 'Vue 友链',
          description: '友链介绍',
          url: 'https://example.com/vue',
          icon: 'lucide:link',
        },
      ],
    },
  ]
}

beforeEach(() => {
  const groups = ref(resultGroups())
  const selection = ref({ query: 'vue', type: 'all' as SearchScope, page: 1 })
  mocks.state = {
    query: computed({
      get: () => selection.value.query,
      set: (value) => {
        selection.value.query = value
      },
    }),
    type: computed({
      get: () => selection.value.type,
      set: (value) => {
        selection.value.type = value
      },
    }),
    page: computed({
      get: () => selection.value.page,
      set: (value) => {
        selection.value.page = value
      },
    }),
    groups,
    results: computed(() => groups.value.flatMap((group) => group.items)),
    total: computed(() => groups.value.reduce((sum, group) => sum + (group.total ?? 0), 0)),
    isSearching: ref(false),
    error: ref(''),
    search: vi.fn().mockResolvedValue(undefined),
    cancel: vi.fn(() => {
      mocks.state.isSearching.value = false
    }),
  }
  vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {})
  vi.spyOn(useRouter(), 'push').mockResolvedValue(undefined)
})

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  hosts.splice(0).forEach((host) => host.remove())
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

async function setup() {
  const host = document.createElement('div')
  document.body.append(host)
  hosts.push(host)
  const wrapper = await mountSuspended(SearchModal, {
    props: { visible: true },
    attachTo: host,
    global: { stubs: { Teleport: true, Transition: false, Icon: true } },
  })
  wrappers.push(wrapper)
  const input = wrapper.get<HTMLInputElement>('input')
  input.element.focus()
  return { wrapper, input }
}

function keydown(target: Element, key: string, options: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options })
  target.dispatchEvent(event)
  return event
}

describe('搜索弹窗关键词高亮', () => {
  it('标题和摘要保留文本节点与原始大小写，不解析结果中的 HTML', async () => {
    const { wrapper } = await setup()
    const first = wrapper.get('.search-modal__item')
    expect(first.get('.search-modal__item-title').text()).toBe('Vue <img src=x onerror=alert(1)> 与 vue')
    expect(first.get('.search-modal__item-desc').text()).toBe('<script>alert(1)</script> VUE 摘要')
    expect(first.findAll('mark').map((mark) => mark.text())).toEqual(['Vue', 'vue', 'VUE'])
    expect(first.find('img').exists()).toBe(false)
    expect(first.find('script').exists()).toBe(false)
  })
})

describe('搜索弹窗键盘导航', () => {
  it('输入框方向键跨组选择并播报位置，Enter 打开对应结果', async () => {
    const { wrapper, input } = await setup()
    const results = wrapper.findAll('.search-modal__item')
    expect(wrapper.find('[data-result-selected="true"]').exists()).toBe(false)
    for (let step = 0; step < 3; step++) {
      expect(keydown(input.element, 'ArrowDown').defaultPrevented).toBe(true)
      await nextTick()
    }
    expect(results[2]!.attributes('data-result-selected')).toBe('true')
    expect(document.activeElement).toBe(input.element)
    expect(wrapper.get('.sr-only[role="status"]').text()).toBe('第 3 项，共 4 项，Vue 项目')
    expect(results[2]!.element.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' })
    keydown(input.element, 'Enter')
    await nextTick()
    expect(useRouter().push).toHaveBeenCalledWith('/projects?project=project')
    expect(wrapper.emitted('update:visible')).toEqual([[false]])
  })

  it('上下键在边界停留，首次向上选择末项；外链仍安全地在新窗口打开', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    const { wrapper, input } = await setup()
    keydown(input.element, 'ArrowUp')
    await nextTick()
    keydown(input.element, 'ArrowDown')
    await nextTick()
    expect(wrapper.get('[data-result-selected="true"]').attributes('href')).toBe('https://example.com/vue')
    keydown(input.element, 'Enter')
    expect(open).toHaveBeenCalledWith('https://example.com/vue', '_blank', 'noopener,noreferrer')
    expect(useRouter().push).not.toHaveBeenCalled()
  })

  it('链接间同步原生焦点，Enter 使用焦点所在项而非鼠标悬停项', async () => {
    const { wrapper } = await setup()
    const results = wrapper.findAll<HTMLAnchorElement>('.search-modal__item')
    results[1]!.element.focus()
    keydown(results[1]!.element, 'ArrowDown')
    await nextTick()
    expect(document.activeElement).toBe(results[2]!.element)
    keydown(results[2]!.element, 'ArrowUp')
    await nextTick()
    expect(document.activeElement).toBe(results[1]!.element)
    await results[0]!.trigger('mouseenter')
    keydown(results[1]!.element, 'Enter')
    expect(useRouter().push).toHaveBeenCalledWith('/posts/second')
  })

  it.each(['ArrowDown', 'ArrowUp', 'Enter'])('输入法处理 %s 时不改变选择、取消默认行为或导航', async (key) => {
    const { wrapper, input } = await setup()
    expect(keydown(input.element, key, { isComposing: true }).defaultPrevented).toBe(false)
    expect(keydown(input.element, key, { keyCode: 229 }).defaultPrevented).toBe(false)
    await nextTick()
    expect(wrapper.find('[data-result-selected="true"]').exists()).toBe(false)
    expect(useRouter().push).not.toHaveBeenCalled()
  })

  it('保留浏览器组合键和筛选按钮的键盘操作', async () => {
    const { wrapper, input } = await setup()
    expect(keydown(input.element, 'ArrowDown', { shiftKey: true }).defaultPrevented).toBe(false)
    const result = wrapper.get('.search-modal__item')
    expect(keydown(result.element, 'Enter', { metaKey: true }).defaultPrevented).toBe(false)
    const filter = wrapper.get('.search-modal__filters button')
    expect(keydown(filter.element, 'Enter').defaultPrevented).toBe(false)
    expect(useRouter().push).not.toHaveBeenCalled()
  })

  it('加载中、空结果和清空关键词后不打开旧结果', async () => {
    const { wrapper, input } = await setup()
    keydown(input.element, 'ArrowDown')
    mocks.state.isSearching.value = true
    await nextTick()
    expect(wrapper.find('.search-modal__item').exists()).toBe(false)
    keydown(input.element, 'ArrowDown')
    keydown(input.element, 'Enter')
    mocks.state.groups.value = []
    mocks.state.isSearching.value = false
    await nextTick()
    keydown(input.element, 'ArrowUp')
    keydown(input.element, 'Enter')
    mocks.state.groups.value = resultGroups()
    await input.setValue('   ')
    keydown(input.element, 'Enter')
    expect(useRouter().push).not.toHaveBeenCalled()
  })

  it('新结果重置选择并归还输入焦点，未选择时 Enter 打开新首项', async () => {
    const { wrapper, input } = await setup()
    wrapper.findAll<HTMLAnchorElement>('.search-modal__item')[1]!.element.focus()
    await nextTick()
    mocks.state.groups.value = [resultGroups()[1]!]
    await nextTick()
    await nextTick()
    expect(document.activeElement).toBe(input.element)
    expect(wrapper.find('[data-result-selected="true"]').exists()).toBe(false)
    keydown(input.element, 'Enter')
    expect(useRouter().push).toHaveBeenCalledWith('/projects?project=project')
  })

  it.each(['query', 'type', 'page'] as const)('改变 %s 时重置选择并阻止防抖期间打开旧项', async (field) => {
    const { wrapper, input } = await setup()
    keydown(input.element, 'ArrowUp')
    await nextTick()
    if (field === 'query') mocks.state.query.value = '项目'
    else if (field === 'type') mocks.state.type.value = 'post'
    else mocks.state.page.value = 2
    await nextTick()
    expect(wrapper.find('[data-result-selected="true"]').exists()).toBe(false)
    keydown(input.element, 'Enter')
    expect(useRouter().push).not.toHaveBeenCalled()
  })
})
