/** @file promptEditorForm.test.ts @description 编辑器真实表单的字段聚焦、完整冲突核查和媒体返回焦点 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import type { Ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import Editor from '../../app/components/prompt/Editor.vue'
import { promptForm } from '../../app/features/prompt/editor'
import type { ManagedPrompt } from '../../app/features/prompt/types'
const mocks = vi.hoisted(() => ({
  repo: { adminDetail: vi.fn(), save: vi.fn(), submission: vi.fn() },
  auth: {} as { currentUser: Ref<{ id: string } | null>; restore: ReturnType<typeof vi.fn> },
}))
mockNuxtImport('usePromptRepository', () => () => mocks.repo)
mockNuxtImport('useCurrentUser', () => () => mocks.auth)
const wrappers: { unmount(): void }[] = []
const item = (patch: Partial<ManagedPrompt> = {}): ManagedPrompt => ({
  ...promptForm(),
  id: 1,
  title: '午后光影',
  prompt: 'A quiet room',
  mediaId: 'image',
  externalImageUrl: null,
  imageUrl: '/image.webp',
  width: 600,
  height: 400,
  publishedAt: null,
  revision: 1,
  createdAt: '2026-10-03',
  updatedAt: '2026-10-03',
  ...patch,
})
beforeEach(() => {
  sessionStorage.clear()
  mocks.auth = { currentUser: ref({ id: 'owner' }), restore: vi.fn().mockResolvedValue(true) }
  mocks.repo.adminDetail.mockReset().mockResolvedValue(item())
  mocks.repo.save.mockReset()
  mocks.repo.submission.mockReset()
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.restoreAllMocks()
})
async function setup(id: number | null = null) {
  const wrapper = await mountSuspended(Editor, {
    props: { id, models: [] },
    attachTo: document.body,
    global: {
      stubs: {
        Teleport: true,
        Icon: true,
        CommonImageFrame: defineComponent({
          props: ['src', 'alt'],
          setup: (props) => () => h('img', { src: props.src, alt: props.alt }),
        }),
        AdminMediaWorkspace: defineComponent({
          emits: ['selected'],
          setup:
            (_props, { emit }) =>
            () =>
              h(
                'button',
                {
                  type: 'button',
                  onClick: () => emit('selected', { id: 'chosen-image', alt: '从媒体库选中的效果图' }),
                },
                '选中效果图',
              ),
        }),
      },
    },
  })
  wrappers.push(wrapper)
  await vi.waitFor(() =>
    expect((wrapper.get('.prompt-editor__primary').element as HTMLButtonElement).disabled).toBe(false),
  )
  return wrapper
}
it('提交空表单聚焦标题，修正标题后继续定位缺失提示词，保留已输入内容', async () => {
  const wrapper = await setup()
  await wrapper.get('.prompt-editor__primary').trigger('click')
  await flushPromises()
  const title = wrapper.get<HTMLInputElement>('[data-prompt-field="title"]')
  expect(document.activeElement).toBe(title.element)
  expect(title.attributes('aria-invalid')).toBe('true')
  expect(wrapper.get('#prompt-editor-title-error').text()).toContain('标题')
  await title.setValue('窗边的静物')
  await wrapper.get('.prompt-editor__primary').trigger('click')
  await flushPromises()
  expect(document.activeElement).toBe(wrapper.get('[data-prompt-field="prompt"]').element)
  expect(title.element.value).toBe('窗边的静物')
  expect(wrapper.get('#prompt-editor-title-count').text()).toBe('5 / 160')
  expect(mocks.repo.save).not.toHaveBeenCalled()
})
it('来源不合法时展开更多细节并聚焦对应字段', async () => {
  const wrapper = await setup(1)
  const source = wrapper.get<HTMLInputElement>('[data-prompt-field="sourceUrl"]')
  await source.setValue('javascript:alert(1)')
  await wrapper.get('.prompt-editor__primary').trigger('click')
  await flushPromises()
  expect((wrapper.get('.prompt-editor__optional').element as HTMLDetailsElement).open).toBe(true)
  expect(document.activeElement).toBe(wrapper.get('[data-prompt-field="sourceUrl"]').element)
  expect(wrapper.get('#prompt-editor-sourceUrl-error').text()).toContain('HTTP(S)')
  expect(mocks.repo.save).not.toHaveBeenCalled()
})
it('冲突核查显示服务器完整正负词、效果图、图片描述及来源而不覆盖输入', async () => {
  const wrapper = await setup(1)
  await wrapper.get('[data-prompt-field="prompt"]').setValue('本地新提示词')
  mocks.repo.save.mockRejectedValueOnce(Object.assign(new Error('版本冲突'), { statusCode: 409 }))
  const negative = '完整负面词 '.repeat(40)
  mocks.repo.adminDetail.mockResolvedValueOnce(
    item({
      revision: 2,
      prompt: '服务器完整提示词',
      negativePrompt: negative,
      imageAlt: '服务器图片描述',
      imageUrl: '/server-image.webp',
      sourceUrl: 'https://example.com/original',
      description: '服务器创作笔记',
      model: 'FLUX',
      tags: ['静物'],
    }),
  )
  await wrapper.get('.prompt-editor__primary').trigger('click')
  await flushPromises()
  const comparison = wrapper.get('.prompt-editor__comparison')
  expect(comparison.text()).toContain(negative.trim())
  expect(comparison.text()).toContain('服务器图片描述')
  expect(comparison.get('img').attributes('src')).toBe('/server-image.webp')
  expect(comparison.get('a[href="https://example.com/original"]').text()).toContain('https://example.com/original')
  expect((wrapper.get('[data-prompt-field="prompt"]').element as HTMLTextAreaElement).value).toBe('本地新提示词')
})
it('媒体选择结束后把焦点交还选择按钮并保留正文', async () => {
  const wrapper = await setup(1)
  await wrapper.get('[data-prompt-field="mediaId"]').trigger('click')
  await wrapper.get('.prompt-editor__library button:last-child').trigger('click')
  await flushPromises()
  expect(document.activeElement).toBe(wrapper.get('[data-prompt-field="mediaId"]').element)
  expect((wrapper.get('[data-prompt-field="prompt"]').element as HTMLTextAreaElement).value).toBe('A quiet room')
  expect(wrapper.get('.prompt-editor__preview img').attributes('src')).toContain('chosen-image')
})
it('网络保存失败时底部显示原因并聚焦反馈区，保留输入方便重试', async () => {
  const wrapper = await setup(1)
  await wrapper.get('[data-prompt-field="description"]').setValue('继续补充的创作笔记')
  mocks.repo.save.mockRejectedValueOnce(new Error('网络中断，请稍后重试'))
  await wrapper.get('.prompt-editor__primary').trigger('click')
  await flushPromises()
  expect(wrapper.get('.prompt-editor__footer [role="status"]').text()).toContain('网络中断，请稍后重试')
  expect(document.activeElement).toBe(wrapper.get('.prompt-editor__feedback').element)
  expect((wrapper.get('[data-prompt-field="description"]').element as HTMLTextAreaElement).value).toBe(
    '继续补充的创作笔记',
  )
  expect((wrapper.get('.prompt-editor__primary').element as HTMLButtonElement).disabled).toBe(false)
})
it('公开内容明确提供转为草稿动作并在底部报告成功状态', async () => {
  mocks.repo.adminDetail.mockResolvedValueOnce(item({ status: 'published' }))
  const wrapper = await setup(1)
  const draft = wrapper.get('.prompt-editor__actions .prompt-editor__secondary')
  expect(draft.text()).toBe('转为草稿')
  expect(wrapper.get('.prompt-editor__save-state').text()).toContain('访客将无法查看这份灵感')
  mocks.repo.save.mockResolvedValueOnce(item({ status: 'draft', revision: 2 }))
  await draft.trigger('click')
  await flushPromises()
  expect(mocks.repo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'draft' }), expect.any(String), 1, 1)
  expect(wrapper.get('.prompt-editor__footer [role="status"]').text()).toContain('草稿已保存，仅博主可见')
  expect(wrapper.get('.prompt-editor__actions .prompt-editor__secondary').text()).toBe('保存草稿')
})
