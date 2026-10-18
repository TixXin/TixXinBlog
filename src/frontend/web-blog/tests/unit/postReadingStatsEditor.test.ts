/** @file postReadingStatsEditor.test.ts @description 文章编辑器实时字数、显式采用阅读时间与输入法及无障碍回归。 */
import { afterEach, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { reactive } from 'vue'
import PostEditor from '../../app/components/admin/PostEditor.vue'
import type { AdminPostDraft } from '../../app/features/post/adminTypes'

const wrappers: { unmount(): void }[] = []

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.restoreAllMocks()
})

async function setup(contentRaw: string, readTimeMinutes = 5) {
  const draft = reactive<AdminPostDraft>({
    title: '中英文写作',
    summary: '',
    cover: '',
    folder: '前端开发',
    category: 'tech',
    status: 'draft',
    contentRaw,
    pinned: false,
    readTimeMinutes,
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

it('实时显示混排字数，正文编辑不改变原来的默认阅读分钟', async () => {
  const { wrapper, draft } = await setup('你好 Vue 3 world!')
  const stats = wrapper.get('[data-post-reading-stats]')
  expect(stats.text().replace(/\s+/g, '')).toBe('正文字数：5（中文2字，英文及数字3词）·建议阅读时间约1分钟')
  expect(draft.readTimeMinutes).toBe(5)

  const body = wrapper.get<HTMLTextAreaElement>('.post-editor__body textarea')
  await body.setValue(
    '你好世界 Nuxt 4 Vue\n\n```ts\nconst ignored = "忽略代码"\n```\n\n![忽略图片](https://example.com/image.png)',
  )
  expect(stats.text().replace(/\s+/g, '')).toBe('正文字数：7（中文4字，英文及数字3词）·建议阅读时间约1分钟')
  expect(draft.readTimeMinutes).toBe(5)
  expect(wrapper.emitted('save')).toBeUndefined()
})

it('空白或仅有代码和图片时显示零字且不可采用估算值', async () => {
  const { wrapper, draft } = await setup('')
  const stats = wrapper.get('[data-post-reading-stats]')
  const apply = wrapper.get<HTMLButtonElement>('button[data-post-apply-reading-time]')
  expect(stats.text().replace(/\s+/g, '')).toBe('正文字数：0（中文0字，英文及数字0词）·建议阅读时间约1分钟')
  expect(apply.element.disabled).toBe(true)
  apply.element.click()
  expect(draft.readTimeMinutes).toBe(5)

  await wrapper
    .get('.post-editor__body textarea')
    .setValue('```text\n不参与字数统计\n```\n\n![图片](https://example.com/image.png)')
  expect(stats.text().replace(/\s+/g, '')).toBe('正文字数：0（中文0字，英文及数字0词）·建议阅读时间约1分钟')
  expect(apply.element.disabled).toBe(true)
  expect(draft.readTimeMinutes).toBe(5)
})

it('点击采用估算仅更新阅读分钟，不提交表单，之后输入仍保留采用值', async () => {
  const { wrapper, draft } = await setup('中'.repeat(2100))
  const stats = wrapper.get('[data-post-reading-stats]')
  expect(stats.text().replace(/\s+/g, '')).toBe('正文字数：2,100（中文2,100字，英文及数字0词）·建议阅读时间约6分钟')
  expect(draft.readTimeMinutes).toBe(5)

  await wrapper.get('button[data-post-apply-reading-time]').trigger('click')
  expect(draft.readTimeMinutes).toBe(6)
  expect(wrapper.get<HTMLInputElement>('input[type="number"]').element.value).toBe('6')
  expect(wrapper.emitted('save')).toBeUndefined()
  expect(wrapper.emitted('reviewing')).toBeUndefined()
  expect(wrapper.get('[role="status"][aria-label="阅读时长填入状态"]').text()).toBe('已填入 6 分钟，可继续手动修改。')

  await wrapper.get('.post-editor__body textarea').setValue('短文')
  expect(stats.text()).toContain('建议阅读时间约 1 分钟')
  expect(draft.readTimeMinutes).toBe(6)
})

it('手动填写的分钟在修改正文时保持，只有再次主动采用才覆盖', async () => {
  const { wrapper, draft } = await setup('中'.repeat(350), 9)
  const minutes = wrapper.get<HTMLInputElement>('input[type="number"]')
  await minutes.setValue(13)
  await wrapper.get('.post-editor__body textarea').setValue('中'.repeat(700))
  expect(draft.readTimeMinutes).toBe(13)
  expect(minutes.element.value).toBe('13')

  await wrapper.get('button[data-post-apply-reading-time]').trigger('click')
  expect(draft.readTimeMinutes).toBe(2)
  await minutes.setValue(29)
  await wrapper.get('.post-editor__body textarea').setValue('中'.repeat(1050))
  expect(draft.readTimeMinutes).toBe(29)
})

it('保存中禁用估算按钮，结束保存后可以采用当前正文的估算值', async () => {
  const { wrapper, draft } = await setup('中'.repeat(700), 12)
  const apply = wrapper.get<HTMLButtonElement>('button[data-post-apply-reading-time]')
  await wrapper.setProps({ pending: true })
  expect(apply.element.disabled).toBe(true)
  await apply.trigger('click')
  expect(draft.readTimeMinutes).toBe(12)
  expect(wrapper.emitted('save')).toBeUndefined()

  await wrapper.setProps({ pending: false })
  expect(apply.element.disabled).toBe(false)
  await apply.trigger('click')
  expect(draft.readTimeMinutes).toBe(2)
})

it('恢复新的 modelValue 后重新统计正文并保留恢复副本的阅读分钟', async () => {
  const { wrapper, draft } = await setup('旧正文', 8)
  const restored = { ...draft, contentRaw: 'new '.repeat(440), readTimeMinutes: 17 }
  await wrapper.setProps({ modelValue: restored })
  expect(wrapper.get('[data-post-reading-stats]').text().replace(/\s+/g, '')).toBe(
    '正文字数：440（中文0字，英文及数字440词）·建议阅读时间约2分钟',
  )
  expect(wrapper.get<HTMLInputElement>('input[type="number"]').element.value).toBe('17')
  expect(restored.readTimeMinutes).toBe(17)
  await wrapper.get('button[data-post-apply-reading-time]').trigger('click')
  expect(restored.readTimeMinutes).toBe(2)
  expect(draft.readTimeMinutes).toBe(8)
})

it('输入法合成期间保留已完成正文的统计，完成输入才更新', async () => {
  const { wrapper, draft } = await setup('原文', 11)
  const body = wrapper.get<HTMLTextAreaElement>('.post-editor__body textarea')
  const stats = wrapper.get('[data-post-reading-stats]')
  const originalStats = stats.text()
  body.element.focus()
  await body.trigger('compositionstart')
  body.element.value = '新的中文输入 Vue'
  body.element.setSelectionRange(body.element.value.length, body.element.value.length)
  await body.trigger('input')
  const caret = body.element.selectionStart
  expect(draft.contentRaw).toBe('原文')
  expect(stats.text()).toBe(originalStats)
  expect(body.element.selectionStart).toBe(caret)

  await body.trigger('compositionend')
  expect(draft.contentRaw).toBe('新的中文输入 Vue')
  expect(stats.text().replace(/\s+/g, '')).toBe('正文字数：7（中文6字，英文及数字1词）·建议阅读时间约1分钟')
  expect(draft.readTimeMinutes).toBe(11)
  expect(document.activeElement).toBe(body.element)
})

it('正文和分钟输入关联统计说明，采用操作保留可聚焦的原生按钮语义', async () => {
  const { wrapper } = await setup('可以阅读')
  const stats = wrapper.get('[data-post-reading-stats]')
  const statsId = stats.attributes('id')
  expect(statsId).toBeTruthy()
  const body = wrapper.get<HTMLTextAreaElement>('.post-editor__body textarea')
  const minutes = wrapper.get<HTMLInputElement>('input[type="number"]')
  expect(body.attributes('aria-describedby').split(/\s+/)).toContain(statsId)
  expect(minutes.attributes('aria-describedby').split(/\s+/)).toContain(statsId)

  const apply = wrapper.get<HTMLButtonElement>('button[data-post-apply-reading-time]')
  expect(apply.element.type).toBe('button')
  expect(apply.element.disabled).toBe(false)
  expect(apply.element.tabIndex).toBe(0)
  expect(apply.text()).toBe('按字数估算阅读时长')
  apply.element.focus()
  expect(document.activeElement).toBe(apply.element)
  expect(wrapper.emitted('save')).toBeUndefined()
})
