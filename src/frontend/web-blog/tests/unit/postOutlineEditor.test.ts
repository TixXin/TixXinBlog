/** @file postOutlineEditor.test.ts @description 实际文章表单章节定位，不改正文、提交状态或输入法未完成内容。 */
import { afterEach, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import PostEditor from '../../app/components/admin/PostEditor.vue'
import type { AdminPostDraft } from '../../app/features/post/adminTypes'
import { reactive } from 'vue'

const wrappers: { unmount(): void }[] = []
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.restoreAllMocks()
})
async function setup(contentRaw: string) {
  const draft = reactive<AdminPostDraft>({
    title: '长文写作',
    summary: '',
    cover: '',
    folder: '前端开发',
    category: 'tech',
    status: 'draft',
    contentRaw,
    pinned: false,
    readTimeMinutes: 10,
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
        ArticleMarkdown: true,
      },
    },
  })
  wrappers.push(wrapper)
  return { wrapper, draft }
}

it('实际挂载长文表单后，可以选择后半部分章节且不修改正文或触发保存', async () => {
  const raw = '# 起点\n\n' + '继续记录中文正文。\n'.repeat(200) + '\n## 回顾\n\n结尾'
  const { wrapper, draft } = await setup(raw)
  const body = wrapper.get<HTMLTextAreaElement>('.post-editor__body textarea')
  const original = body.element
  const chapters = wrapper.get('select[aria-label="选择正文章节"]')
  await chapters.setValue('1')
  const snapshot = JSON.stringify(draft)
  await wrapper.get('button[data-post-outline-jump]').trigger('click')
  expect(wrapper.get('.post-editor__body textarea').element).toBe(original)
  expect(body.element.selectionStart).toBe(raw.indexOf('## 回顾'))
  expect(body.element.selectionEnd).toBe(raw.indexOf('## 回顾'))
  expect(document.activeElement).toBe(original)
  expect(JSON.stringify(draft)).toBe(snapshot)
  expect(wrapper.emitted('save')).toBeUndefined()
  expect(wrapper.emitted('reviewing')).toBeUndefined()
})

it('编辑只刷新章节选项，保留正文节点、焦点和选区；保存中不可定位', async () => {
  const { wrapper, draft } = await setup('# 前言\n\n## 旧标题')
  const body = wrapper.get<HTMLTextAreaElement>('.post-editor__body textarea')
  const original = body.element
  await body.setValue('# 前言\n\n## 新标题\n\n### 更多内容')
  body.element.focus()
  body.element.setSelectionRange(4, 6)
  expect(wrapper.get('select[aria-label="选择正文章节"]').text()).toContain('新标题')
  expect(wrapper.get('select[aria-label="选择正文章节"]').findAll('option')).toHaveLength(4)
  expect(body.element.selectionStart).toBe(4)
  expect(body.element.selectionEnd).toBe(6)
  expect(body.element).toBe(original)
  await wrapper.get('select[aria-label="选择正文章节"]').setValue('2')
  await wrapper.setProps({ pending: true })
  expect(wrapper.get('button[data-post-outline-jump]').attributes('disabled')).toBeDefined()
  expect(draft.contentRaw).toBe('# 前言\n\n## 新标题\n\n### 更多内容')
})

it('输入法合成期间不接管光标，完成输入后按最新章节定位', async () => {
  const { wrapper, draft } = await setup('# 前言\n\n## 原标题')
  const body = wrapper.get<HTMLTextAreaElement>('.post-editor__body textarea')
  const chapters = wrapper.get('select[aria-label="选择正文章节"]')
  await chapters.setValue('1')
  body.element.focus()
  await body.trigger('compositionstart')
  body.element.value = '# 前言\n\n## 中文输入中的标题'
  body.element.setSelectionRange(body.element.value.length, body.element.value.length)
  await body.trigger('input')
  const caret = body.element.selectionStart
  expect(draft.contentRaw).toBe('# 前言\n\n## 原标题')
  expect(chapters.attributes('disabled')).toBeDefined()
  await wrapper.get('button[data-post-outline-jump]').trigger('click')
  expect(body.element.selectionStart).toBe(caret)
  await body.trigger('compositionend')
  expect(draft.contentRaw).toBe('# 前言\n\n## 中文输入中的标题')
  expect(chapters.text()).toContain('中文输入中的标题')
  await wrapper.get('button[data-post-outline-jump]').trigger('click')
  expect(body.element.selectionStart).toBe(draft.contentRaw.indexOf('##'))
})

it('恢复替换正文后采用新章节；没有标题时保持真实空态', async () => {
  const { wrapper } = await setup('# 旧副本\n\n## 旧章节')
  const chapters = wrapper.get('select[aria-label="选择正文章节"]')
  await chapters.setValue('1')
  const restored = { ...wrapper.props('modelValue'), contentRaw: '恢复的正文\n\n新章节\n====' }
  await wrapper.setProps({ modelValue: restored })
  expect(chapters.text()).not.toContain('旧章节')
  expect(chapters.text()).toContain('新章节')
  expect(wrapper.get('button[data-post-outline-jump]').attributes('disabled')).toBeDefined()
  await chapters.setValue('0')
  await wrapper.get('button[data-post-outline-jump]').trigger('click')
  expect(wrapper.get<HTMLTextAreaElement>('.post-editor__body textarea').element.selectionStart).toBe(
    restored.contentRaw.indexOf('新章节'),
  )
  await wrapper.setProps({ modelValue: { ...restored, contentRaw: '普通正文，没有标题' } })
  expect(chapters.attributes('disabled')).toBeDefined()
  expect(wrapper.get('[aria-label="正文章节导航"]').text()).toContain('添加 Markdown 标题')
})

it('载入 CRLF 正文时按 textarea 的 LF 位置定位，不回写原始行尾', async () => {
  const raw = '# 前言\r\n\r\n## 后半部分\r\n正文'
  const { wrapper, draft } = await setup(raw)
  await wrapper.get('select[aria-label="选择正文章节"]').setValue('1')
  await wrapper.get('button[data-post-outline-jump]').trigger('click')
  expect(wrapper.get<HTMLTextAreaElement>('.post-editor__body textarea').element.selectionStart).toBe(
    raw.replace(/\r\n/g, '\n').indexOf('## 后半部分'),
  )
  expect(draft.contentRaw).toBe(raw)
})
