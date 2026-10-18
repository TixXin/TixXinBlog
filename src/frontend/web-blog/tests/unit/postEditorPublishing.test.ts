/** @file postEditorPublishing.test.ts @description 发布前替代文本警告、继续发布、返回编辑与草稿保存回归。 */
import { afterEach, expect, it } from 'vitest'
import { reactive } from 'vue'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import PostEditor from '../../app/components/admin/PostEditor.vue'
import type { AdminPostDraft } from '../../app/features/post/adminTypes'

const wrappers: { unmount(): void }[] = []
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
})

async function setup(values: Partial<AdminPostDraft> = {}) {
  const draft = reactive<AdminPostDraft>({
    title: '旅行记录',
    summary: '山间的一天',
    cover: '',
    folder: '生活',
    category: 'life',
    status: 'draft',
    contentRaw: '正文',
    pinned: false,
    readTimeMinutes: 3,
    tags: [],
    ...values,
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
  const dialog = wrapper.get<HTMLDialogElement>('dialog.post-editor__publish')
  const button = (text: string) => wrapper.findAll('button').find((item) => item.text() === text)!
  return { wrapper, draft, dialog, button }
}

it('发布前列出封面与正文缺失位置，警告供读屏读取且允许明确继续发布', async () => {
  const { wrapper, draft, dialog, button } = await setup({
    cover: '/cover.webp',
    contentRaw: '![已有说明](/ok.webp)\n\n![](/missing.webp) ![ ](/blank.webp)',
  })
  await button('发布文章').trigger('click')
  // 打开检查会规范化地址标识；确认发布本身不应改写正文、封面或替代文本。
  const snapshot = JSON.stringify(draft)
  expect(dialog.element.open).toBe(true)
  expect(wrapper.emitted('save')).toBeUndefined()
  expect(wrapper.emitted('reviewing')).toEqual([[true]])
  const warning = dialog.get('section[aria-labelledby="publish-alt-title"]')
  expect(warning.findAll('li').map((item) => item.text())).toEqual([
    '封面缺少替代文本，请填写“封面替代文本”。',
    '正文第 2 张图片（第 3 行）缺少替代文本。',
    '正文第 3 张图片（第 3 行）缺少替代文本。',
  ])
  expect(dialog.attributes('aria-describedby')).toBe('publish-alt-description')
  expect(dialog.get('#publish-alt-description').text()).toContain('也可仍然发布')
  expect(button('仍然公开发布').attributes('disabled')).toBeUndefined()
  await button('仍然公开发布').trigger('click')
  expect(wrapper.emitted('save')).toEqual([['published']])
  expect(dialog.element.open).toBe(false)
  expect(JSON.stringify(draft)).toBe(snapshot)
})

it('返回编辑不发布，补齐替代文本后重新检查不保留旧警告', async () => {
  const { wrapper, draft, dialog, button } = await setup({
    cover: '/cover.webp',
    coverAlt: ' \t ',
    contentRaw: '![](/missing.webp)',
  })
  await button('发布文章').trigger('click')
  expect(dialog.findAll('li')).toHaveLength(2)
  await button('返回编辑').trigger('click')
  expect(dialog.element.open).toBe(false)
  expect(wrapper.emitted('save')).toBeUndefined()
  draft.coverAlt = '远山映在湖面上'
  await wrapper.get('.post-editor__body textarea').setValue('![夕阳中的湖面](/missing.webp)')
  await button('发布文章').trigger('click')
  expect(dialog.find('.post-editor__alt-warnings').exists()).toBe(false)
  expect(dialog.attributes('aria-describedby')).toBeUndefined()
  await button('确认公开发布').trigger('click')
  expect(wrapper.emitted('save')).toEqual([['published']])
})

it('未设置封面且正文没有缺失说明时，沿用普通发布确认', async () => {
  const { dialog, button } = await setup({ contentRaw: '代码示例 `![](/example.webp)`' })
  await button('发布文章').trigger('click')
  expect(dialog.find('.post-editor__alt-warnings').exists()).toBe(false)
  expect(dialog.text()).toContain('未设置封面')
  expect(button('确认公开发布')).toBeDefined()
})

it('仅封面缺少说明时也提示，移除封面后清除该警告', async () => {
  const { wrapper, draft, dialog, button } = await setup({ cover: '/cover.webp', coverAlt: '' })
  await button('发布文章').trigger('click')
  expect(dialog.findAll('li').map((item) => item.text())).toEqual(['封面缺少替代文本，请填写“封面替代文本”。'])
  await button('返回编辑').trigger('click')
  draft.cover = ''
  await wrapper.vm.$nextTick()
  await button('发布文章').trigger('click')
  expect(dialog.find('.post-editor__alt-warnings').exists()).toBe(false)
})

it('保存草稿直接提交，更新已公开文章仍需经过警告与确认；保存中不能确认', async () => {
  const { wrapper, draft, dialog, button } = await setup({ contentRaw: '![](/missing.webp)' })
  await wrapper.get('form').trigger('submit')
  expect(wrapper.emitted('save')).toEqual([['draft']])
  expect(dialog.element.open).toBe(false)
  draft.status = 'published'
  await wrapper.vm.$nextTick()
  await wrapper.get('form').trigger('submit')
  expect(dialog.element.open).toBe(true)
  expect(dialog.text()).toContain('更新当前公开文章')
  expect(dialog.findAll('li')).toHaveLength(1)
  await wrapper.setProps({ pending: true })
  expect(button('仍然公开发布').attributes('disabled')).toBeDefined()
  await button('仍然公开发布').trigger('click')
  expect(wrapper.emitted('save')).toHaveLength(1)
  await wrapper.setProps({ pending: false })
  await button('仍然公开发布').trigger('click')
  expect(wrapper.emitted('save')).toEqual([['draft'], ['published']])
})

it('键盘保存已发布文章同样进入检查，确认前不触发发布', async () => {
  const { wrapper, dialog } = await setup({ status: 'published', contentRaw: '![](/missing.webp)' })
  const event = new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true })
  document.body.dispatchEvent(event)
  await wrapper.vm.$nextTick()
  expect(event.defaultPrevented).toBe(true)
  expect(dialog.element.open).toBe(true)
  expect(dialog.text()).toContain('正文第 1 张图片（第 1 行）缺少替代文本')
  expect(wrapper.emitted('save')).toBeUndefined()
})
