/**
 * @file adminMediaI18n.test.ts
 * @description 后台媒体库英文冒烟：上传说明、筛选、批量回收提示、引用标签与离开确认随界面语言切换，中文保持原文
 * @author TixXin
 * @since 2026-10-19
 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import MediaLibrary from '../../app/components/admin/MediaLibrary.vue'
import { useMediaLibrary } from '../../app/composables/useMediaLibrary'
import type { MediaAsset, MediaReferences } from '../../app/features/media/types'

const mocks = vi.hoisted(() => ({ api: vi.fn(), leave: [] as (() => boolean)[] }))
mockNuxtImport('useCurrentUser', () => () => ({ currentUser: ref({ id: 'owner' }), restore: async () => true }))
mockNuxtImport('useAdminApi', () => () => mocks.api)
mockNuxtImport('useMediaUpload', () => () => ({ upload: vi.fn(), cancel: vi.fn() }))
mockNuxtImport('useToast', () => () => ({ success: vi.fn(), info: vi.fn() }))
mockNuxtImport('onBeforeRouteLeave', () => (guard: () => boolean) => void mocks.leave.push(guard))
mockNuxtImport('onBeforeRouteUpdate', () => () => undefined)

/** 用到时再取：收集阶段 Nuxt 测试应用尚未就绪 */
const i18n = () => useNuxtApp().$i18n

const asset: MediaAsset = {
  id: 'media-1',
  name: '山间晨光.webp',
  url: '/media-1.webp',
  alt: '山间晨光',
  description: '',
  width: 900,
  height: 600,
  byteSize: 2048,
  mimeType: 'image/webp',
  createdAt: '2026-10-10T00:00:00Z',
  deleted: false,
}
const references: MediaReferences = {
  total: 1,
  page: 1,
  pageSize: 20,
  items: [{ kind: 'revision', revision: 3, title: '春日随笔', url: '/admin/posts/1' }],
} as MediaReferences
const wrappers: { unmount(): void }[] = []
beforeEach(() => {
  mocks.leave.length = 0
  mocks.api.mockReset().mockImplementation(async (path: string) => {
    if (path === '/admin/media') return { items: [structuredClone(asset)], total: 1 }
    if (path.endsWith('/references')) return structuredClone(references)
    throw new Error(`未声明的请求：${path}`)
  })
})
afterEach(async () => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  await i18n().setLocale('zh-CN')
})

async function setup() {
  let state!: ReturnType<typeof useMediaLibrary>
  const wrapper = await mountSuspended(
    defineComponent({
      setup() {
        state = useMediaLibrary(false)
        return () => h(MediaLibrary, { selectable: false, controller: state })
      },
    }),
    {
      route: '/admin/media',
      attachTo: document.body,
      global: { stubs: { Icon: true, CommonTooltip: { template: '<span><slot /></span>' } } },
    },
  )
  wrappers.push(wrapper)
  await flushPromises()
  return { wrapper, state }
}

it('中文界面保持原有媒体库文案', async () => {
  const { wrapper, state } = await setup()
  expect(wrapper.text()).toContain('支持静态 JPEG、PNG、WebP，单张不超过 8MB；上传后优化为 WebP 并移除元信息。')
  expect(wrapper.find('.media-library__batch-hint').text()).toBe('请先勾选本页要回收的资源。')
  expect(wrapper.find('.media-library__page-summary').text()).toBe('1 / 1 · 共 1 项')
  await state.showReferences('media-1')
  await flushPromises()
  expect(wrapper.find('.media-library__references h3').text()).toBe('山间晨光.webp · 引用位置（1）')
  expect(wrapper.find('.media-library__reference-list').text()).toContain('春日随笔 · 文章历史版本 3')
})

it('切到英文后媒体库界面、引用标签与离开确认均为英文', async () => {
  await i18n().setLocale('en')
  const { wrapper, state } = await setup()
  const text = wrapper.text()
  expect(text).toContain('Static JPEG, PNG and WebP up to 8 MB each.')
  expect(text).toContain('Move selected to trash')
  expect(text).toContain('Save alt text')
  // 除资源名外不应残留中文界面文案
  expect(text.replaceAll('山间晨光', '')).not.toMatch(/[一-鿿]/u)
  expect(wrapper.find('.media-library__batch-hint').text()).toBe(
    'Select the assets on this page you want to move to trash.',
  )
  expect(wrapper.find('.media-library__page-summary').text()).toBe('1 / 1 · 1 total')
  expect(wrapper.get('input[aria-label="Select 山间晨光.webp"]').exists()).toBe(true)
  await state.showReferences('media-1')
  await flushPromises()
  expect(wrapper.find('.media-library__references h3').text()).toBe('山间晨光.webp · Used in (1)')
  expect(wrapper.find('.media-library__reference-list').text()).toContain('春日随笔 · Post revision r3')

  // 有未保存说明时离开，确认框文案随语言
  state.altDrafts['media-1'] = '改过的替代文本'
  const confirm = vi.fn().mockReturnValue(false)
  vi.stubGlobal('confirm', confirm)
  expect(mocks.leave.at(-1)?.()).toBe(false)
  expect(confirm).toHaveBeenCalledWith(
    expect.stringContaining('Uploads or unsaved alt text and notes are still pending.'),
  )
})
