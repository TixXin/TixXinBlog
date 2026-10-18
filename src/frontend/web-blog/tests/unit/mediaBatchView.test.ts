/**
 * @file mediaBatchView.test.ts
 * @description 媒体批量选择、逐项结果、引用面板状态与键盘焦点的组件回归。
 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import MediaLibrary from '../../app/components/admin/MediaLibrary.vue'
import { useMediaLibrary } from '../../app/composables/useMediaLibrary'
import type { MediaAsset, MediaReferences } from '../../app/features/media/types'

const mocks = vi.hoisted(() => ({ api: vi.fn() }))
mockNuxtImport('useCurrentUser', () => () => ({ currentUser: ref({ id: 'owner' }), restore: async () => true }))
mockNuxtImport('useAdminApi', () => () => mocks.api)
mockNuxtImport('useMediaUpload', () => () => ({ upload: vi.fn(), cancel: vi.fn() }))
mockNuxtImport('useToast', () => () => ({ success: vi.fn() }))
mockNuxtImport('onBeforeRouteLeave', () => () => undefined)
mockNuxtImport('onBeforeRouteUpdate', () => () => undefined)

const assets: MediaAsset[] = ['山间晨光', '雨后庭院'].map((name, index) => ({
  id: `media-${index + 1}`,
  name: `${name}.webp`,
  url: `/media-${index + 1}.webp`,
  alt: name,
  description: '',
  width: 900,
  height: 600,
  byteSize: 1000,
  mimeType: 'image/webp',
  createdAt: '2026-10-10T00:00:00Z',
  deleted: false,
}))
const emptyReferences = (): MediaReferences => ({ total: 0, page: 1, pageSize: 20, items: [] })
const wrappers: { unmount(): void }[] = []
beforeEach(() => {
  mocks.api.mockReset().mockImplementation(async (path: string) => {
    if (path === '/admin/media') return { items: structuredClone(assets), total: 2 }
    if (path.endsWith('/references')) return emptyReferences()
    throw new Error(`未声明的请求：${path}`)
  })
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.restoreAllMocks()
})
async function setup(selectable = false, route = '/admin/media') {
  let state!: ReturnType<typeof useMediaLibrary>
  const wrapper = await mountSuspended(
    defineComponent({
      setup() {
        state = useMediaLibrary(selectable)
        return () => h(MediaLibrary, { selectable, controller: state })
      },
    }),
    {
      route,
      attachTo: document.body,
      global: { stubs: { Icon: true, CommonTooltip: { template: '<span><slot /></span>' } } },
    },
  )
  wrappers.push(wrapper)
  await flushPromises()
  return { wrapper, state }
}

it('原生复选框提供文件名标签、全选和半选，批量操作跟随选择及忙碌状态', async () => {
  const { wrapper, state } = await setup()
  const all = wrapper.get<HTMLInputElement>('.media-library__batch input[type="checkbox"]')
  const remove = wrapper.findAll('button').find((button) => button.text() === '批量移入回收')!
  expect(remove.attributes('disabled')).toBeDefined()
  // 禁用原因常驻显示，并通过 aria-describedby 关联到按钮
  const hint = () => wrapper.find('.media-library__batch-hint')
  expect(hint().text()).toBe('请先勾选本页要回收的资源。')
  expect(remove.attributes('aria-describedby')).toBe(hint().attributes('id'))
  await wrapper.get('input[aria-label="选择 山间晨光.webp"]').setValue(true)
  expect(hint().exists()).toBe(false)
  expect(remove.attributes('aria-describedby')).toBeUndefined()
  expect(all.element.checked).toBe(false)
  expect(all.element.indeterminate).toBe(true)
  expect(wrapper.get('.media-library__batch [role="status"]').text()).toBe('已选择 1 项')
  expect(remove.attributes('disabled')).toBeUndefined()
  await all.setValue(true)
  expect(all.element.checked).toBe(true)
  expect(all.element.indeterminate).toBe(false)
  expect(state.selectedIds.value).toEqual(['media-1', 'media-2'])
  state.working.value = true
  await nextTick()
  expect(all.attributes('disabled')).toBeDefined()
  expect(remove.attributes('disabled')).toBeDefined()
  expect(hint().text()).toBe('上传或其他操作进行中，完成后才能批量回收。')
  expect(remove.attributes('aria-describedby')).toBe(hint().attributes('id'))
  state.working.value = false
  state.altDrafts['media-1'] = '尚未保存的说明'
  await nextTick()
  expect(hint().text()).toBe('请先保存替代文本或素材说明的修改，再批量回收。')
})

it('嵌入选择器与回收资源视图不展示多选或批量回收', async () => {
  const picker = await setup(true)
  expect(picker.wrapper.find('input[type="checkbox"]').exists()).toBe(false)
  expect(picker.wrapper.text()).not.toContain('批量移入回收')
  const recycled = await setup(false, '/admin/media?deleted=true')
  expect(recycled.wrapper.find('input[type="checkbox"]').exists()).toBe(false)
  expect(recycled.wrapper.text()).not.toContain('批量移入回收')
})

it('引用面板加载时显示目标名称并聚焦标题，Escape 关闭后归还触发按钮', async () => {
  const { wrapper, state } = await setup()
  let finish!: (value: MediaReferences) => void
  mocks.api.mockImplementationOnce(
    () =>
      new Promise<MediaReferences>((resolve) => {
        finish = resolve
      }),
  )
  const trigger = wrapper.findAll('button').find((button) => button.text() === '查看引用')!
  await trigger.trigger('click')
  await nextTick()
  const panel = wrapper.get('.media-library__references')
  expect(panel.text()).toContain('山间晨光.webp · 引用位置')
  expect(panel.get('[role="status"]').text()).toBe('正在读取引用位置…')
  expect(document.activeElement).toBe(panel.get('h3').element)
  finish(emptyReferences())
  await flushPromises()
  expect(panel.text()).toContain('该资源当前没有内容或历史版本引用')
  await panel.trigger('keydown', { key: 'Escape' })
  await nextTick()
  expect(state.referenceId.value).toBe('')
  expect(wrapper.find('.media-library__references').exists()).toBe(false)
  expect(document.activeElement).toBe(trigger.element)
})

it('更换媒体时清掉上一资源引用，失败可重试且不会误报无引用', async () => {
  const { wrapper, state } = await setup()
  mocks.api.mockResolvedValueOnce({
    total: 1,
    page: 1,
    pageSize: 20,
    items: [{ kind: 'post', title: '山林随笔', url: '/admin/posts/post-1' }],
  })
  await state.showReferences('media-1')
  await nextTick()
  expect(wrapper.get('.media-library__references').text()).toContain('山林随笔')
  mocks.api.mockRejectedValueOnce(new Error('网络中断'))
  const trigger = wrapper.findAll('button').filter((button) => button.text() === '查看引用')[1]!
  await trigger.trigger('click')
  await flushPromises()
  const panel = wrapper.get('.media-library__references')
  expect(panel.text()).toContain('雨后庭院.webp · 引用位置')
  expect(panel.find('[role="alert"]').exists()).toBe(true)
  expect(panel.text()).not.toContain('山林随笔')
  expect(panel.text()).not.toContain('该资源当前没有内容或历史版本引用')
  await panel
    .findAll('button')
    .find((button) => button.text() === '重新读取引用')!
    .trigger('click')
  await flushPromises()
  expect(panel.text()).toContain('该资源当前没有内容或历史版本引用')
})

it('引用页按返回的分页大小判断下一页，并识别平台订阅和历史版本位置', async () => {
  const { wrapper, state } = await setup()
  mocks.api.mockResolvedValueOnce({
    total: 3,
    page: 1,
    pageSize: 2,
    items: [
      { kind: 'subscription', title: '云端工作台', url: '/admin/subscriptions' },
      { kind: 'revision', title: '山林随笔', url: '/admin/posts/post-1', revision: 4 },
      // 后端当前内容引用的 revision 列为 null
      { kind: 'post', title: '秋日来信', url: '/admin/posts/post-2', revision: null },
    ],
  })
  await state.showReferences('media-1')
  await nextTick()
  const panel = wrapper.get('.media-library__references')
  expect(panel.text()).toContain('平台订阅图标')
  expect(panel.text()).toContain('文章历史版本 4')
  expect(panel.text()).toContain('秋日来信 · 当前文章')
  expect(panel.text()).not.toContain('null')
  expect(panel.get('.media-library__pagination span').text()).toBe('1 / 2')
  const next = panel.findAll('button').find((button) => button.text() === '下一页引用')!
  expect(next.attributes('disabled')).toBeUndefined()
  await next.trigger('click')
  await flushPromises()
  expect(mocks.api).toHaveBeenLastCalledWith('/admin/media/media-1/references', { query: { page: 2 } })
  expect(document.activeElement).toBe(panel.get('h3').element)
})

it('批量结果逐项展示成功、失败和保护原因，引用结果可继续打开完整引用面板', async () => {
  const { wrapper, state } = await setup()
  state.batchResults.value = [
    { id: 'removed', name: '湖面.webp', status: 'removed', message: '已移入回收' },
    {
      id: 'outside-current-page',
      name: '旧站点图标.webp',
      status: 'referenced',
      message: '仍有 1 处引用',
      references: {
        total: 1,
        page: 1,
        pageSize: 20,
        items: [{ kind: 'site-revision', title: '站点设置', url: '/admin/site', revision: 2 }],
      },
    },
    { id: 'failed', name: '雨巷.webp', status: 'failed', message: '处理未确认，请重新读取后核对' },
  ]
  await nextTick()
  const result = wrapper.get('.media-library__results')
  expect(result.attributes('aria-live')).toBe('polite')
  expect(result.text()).toContain('湖面.webp · 已移入回收')
  expect(result.text()).toContain('旧站点图标.webp · 因引用而保留')
  expect(result.text()).toContain('站点历史版本 2')
  expect(result.text()).toContain('雨巷.webp · 处理失败')
  expect(result.text()).toContain('处理未确认，请重新读取后核对')
  await result.get('button').trigger('click')
  await flushPromises()
  expect(mocks.api).toHaveBeenLastCalledWith('/admin/media/outside-current-page/references', {
    query: { page: 1 },
  })
  expect(wrapper.get('.media-library__references h3').text()).toContain('旧站点图标.webp')
})
