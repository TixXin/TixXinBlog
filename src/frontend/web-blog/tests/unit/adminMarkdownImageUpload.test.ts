/** @file adminMarkdownImageUpload.test.ts @description 文章正文粘贴/拖拽图片：类型与大小与后端一致、光标处占位、成功替换为 Markdown 图片、失败可见并提示、纯文本粘贴不受影响 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import PostEditor from '../../app/components/admin/PostEditor.vue'
import {
  MARKDOWN_IMAGE_MAX_BYTES,
  markdownImage,
  prepareImageFiles,
} from '../../app/composables/useAdminMarkdownImageUpload'
import type { AdminPostDraft } from '../../app/features/post/adminTypes'

const mocks = vi.hoisted(() => ({
  upload: vi.fn(),
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}))
mockNuxtImport('useMediaUpload', () => () => ({ upload: mocks.upload, cancel: vi.fn() }))
mockNuxtImport('useToast', () => () => mocks.toast)

const wrappers: { unmount(): void }[] = []
beforeEach(() => {
  mocks.upload.mockReset()
  Object.values(mocks.toast).forEach((mock) => mock.mockReset())
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
})

function image(name: string, type = 'image/png', size = 1024) {
  const file = new File([new Uint8Array(size)], name, { type })
  return file
}
function asset(name: string, alt = '') {
  return { id: name, name, url: `/media/${name}.webp`, alt }
}
/** jsdom 没有可构造的 ClipboardEvent/DragEvent 数据，按浏览器形状补上 clipboardData 与 dataTransfer */
function paste(target: HTMLElement, files: File[], text = '') {
  const event = new Event('paste', { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'clipboardData', {
    value: { files, items: [], getData: (type: string) => (type === 'text/plain' ? text : '') },
  })
  target.dispatchEvent(event)
  return event
}
function drop(target: HTMLElement, files: File[]) {
  const over = new Event('dragover', { bubbles: true, cancelable: true })
  Object.defineProperty(over, 'dataTransfer', { value: { types: ['Files'], dropEffect: 'none' } })
  target.dispatchEvent(over)
  const event = new Event('drop', { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'dataTransfer', { value: { types: ['Files'], files } })
  target.dispatchEvent(event)
  return { over, event }
}

async function setup(contentRaw = '前文后文') {
  const draft = reactive<AdminPostDraft>({
    title: '图片上传',
    summary: '',
    cover: '',
    folder: '前端开发',
    category: 'tech',
    status: 'draft',
    contentRaw,
    pinned: false,
    readTimeMinutes: 3,
    tags: [],
  })
  const wrapper = await mountSuspended(PostEditor, {
    props: { modelValue: draft, tags: '', pending: false, error: '' },
    attachTo: document.body,
    global: {
      stubs: {
        AdminActionBar: { template: '<div><slot /></div>' },
        AdminBackLink: true,
        AdminMediaPicker: true,
        AdminContentRelations: true,
        ArticleMarkdown: true,
      },
    },
  })
  wrappers.push(wrapper)
  const body = wrapper.get<HTMLTextAreaElement>('.post-editor__body textarea').element
  return { wrapper, draft, body }
}

it('文件预处理与后端一致：仅 JPEG/PNG/WebP、不超过 8MB，补齐扩展名，通用截图名不作替代文本', () => {
  const { accepted, rejected } = prepareImageFiles([
    image('架构图.png'),
    image('image.png'),
    image('', 'image/webp'),
    image('动图.gif', 'image/gif'),
    image('超大.jpg', 'image/jpeg', MARKDOWN_IMAGE_MAX_BYTES + 1),
    new File([], '空.png', { type: 'image/png' }),
  ])
  expect(accepted.map((item) => [item.file.name, item.alt])).toEqual([
    ['架构图.png', '架构图'],
    ['image.png', ''],
    ['image.webp', ''],
  ])
  expect(rejected.map((item) => item.reason)).toEqual([
    '仅支持 JPEG、PNG 和 WebP 图片',
    '图片需不超过 8MB',
    '图片需不超过 8MB',
  ])
  expect(markdownImage('a[b]\nc', '/media/x.webp')).toBe('![a\\[b\\] c](/media/x.webp)')
})

it('粘贴图片在光标处插入占位，上传成功后替换为标准 Markdown 图片，并提示补充替代文本', async () => {
  let finish!: (value: unknown) => void
  mocks.upload.mockImplementation(() => new Promise((resolve) => (finish = resolve)))
  const { draft, body, wrapper } = await setup()
  body.focus()
  body.setSelectionRange(2, 2)
  const event = paste(body, [image('image.png')])
  expect(event.defaultPrevented).toBe(true)
  expect(draft.contentRaw).toMatch(/^前文!\[上传中…\]\(uploading:[0-9a-f]{8}\)后文$/)
  await wrapper.vm.$nextTick()
  // 上传中禁止保存，避免把占位写入服务器。
  expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
  expect(wrapper.get('[role="status"][aria-label="正文图片上传状态"]').text()).toBe('正在上传 1 张图片')
  expect(mocks.upload).toHaveBeenCalledWith(expect.any(File), expect.any(String), '', expect.any(Function))
  // 上传期间用户继续输入，占位仍能被准确定位。
  body.setRangeText('（续写）', body.value.length, body.value.length, 'end')
  body.dispatchEvent(new Event('input'))
  finish(asset('a1'))
  await flushPromises()
  expect(draft.contentRaw).toBe('前文![](/media/a1.webp)后文（续写）')
  expect(mocks.toast.info).toHaveBeenCalledWith(expect.stringContaining('替代文本'))
  expect(wrapper.get('[role="status"][aria-label="正文图片上传状态"]').text()).toBe('图片上传处理完成')
})

it('拖入多张图片并行上传；失败项替换为可见错误并提示，成功项不受影响', async () => {
  mocks.upload.mockImplementation(async (file: File) => {
    if (file.name === '失败.jpg') throw new Error('文件内容不是受支持的图片')
    return asset('ok', '')
  })
  const { draft, body } = await setup('')
  const { over, event } = drop(body, [image('流程图.png'), image('失败.jpg', 'image/jpeg')])
  expect(over.defaultPrevented).toBe(true)
  expect(event.defaultPrevented).toBe(true)
  await flushPromises()
  expect(draft.contentRaw).toBe('![流程图](/media/ok.webp)\n![上传失败：失败.jpg（文件内容不是受支持的图片）]()')
  expect(mocks.upload.mock.calls.map((call) => call[2])).toEqual(['流程图', '失败'])
  expect(mocks.toast.error).toHaveBeenCalledWith('失败.jpg 上传失败：文件内容不是受支持的图片')
})

it('不支持的类型与超限文件直接提示，不上传也不插入占位', async () => {
  const { draft, body } = await setup('正文')
  paste(body, [image('动图.gif', 'image/gif')])
  await flushPromises()
  expect(mocks.upload).not.toHaveBeenCalled()
  expect(draft.contentRaw).toBe('正文')
  expect(mocks.toast.error).toHaveBeenCalledWith('动图.gif：仅支持 JPEG、PNG 和 WebP 图片')
})

it('纯文本或同时含文本的富内容粘贴保持浏览器原行为；保存中不接管', async () => {
  const { body, wrapper } = await setup()
  expect(paste(body, [], '一段文字').defaultPrevented).toBe(false)
  expect(paste(body, [image('网页图.png')], '网页里的说明文字').defaultPrevented).toBe(false)
  await wrapper.setProps({ pending: true })
  expect(paste(body, [image('截图.png')]).defaultPrevented).toBe(false)
  expect(mocks.upload).not.toHaveBeenCalled()
})

it('占位在上传完成前被删除时不强行插入，只提示图片已进入媒体库', async () => {
  let finish!: (value: unknown) => void
  mocks.upload.mockImplementation(() => new Promise((resolve) => (finish = resolve)))
  const { draft, body } = await setup('')
  paste(body, [image('封面.png')])
  body.value = '改写后的正文'
  body.dispatchEvent(new Event('input'))
  finish(asset('cover'))
  await flushPromises()
  expect(draft.contentRaw).toBe('改写后的正文')
  expect(mocks.toast.info).toHaveBeenCalledWith(expect.stringContaining('占位已被删除'))
})
