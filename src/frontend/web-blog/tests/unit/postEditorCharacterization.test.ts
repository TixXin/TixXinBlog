/** @file postEditorCharacterization.test.ts @description 文章编辑器的渲染表征：草稿与已发布状态、标签选项、封面预览与失败、搜索预览和发布检查对话框的结构快照及事件，拆分区块前后必须一致 */
import { afterEach, expect, it } from 'vitest'
import { reactive } from 'vue'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import PostEditor from '../../app/components/admin/PostEditor.vue'
import type { AdminPostDraft } from '../../app/features/post/adminTypes'

const wrappers: { unmount(): void }[] = []
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
})

async function setup(values: Partial<AdminPostDraft> = {}, tags = '旅行, 摄影') {
  const draft = reactive<AdminPostDraft>({
    title: '旅行记录',
    summary: '',
    cover: '',
    folder: '生活',
    category: 'life',
    status: 'draft',
    contentRaw: '# 出发\n\n清晨的山路。\n\n## 抵达\n\n![](/missing.webp)\n\nHello world 你好',
    pinned: false,
    readTimeMinutes: 3,
    tags: [],
    ...values,
  })
  const wrapper = await mountSuspended(PostEditor, {
    props: {
      modelValue: draft,
      tags,
      pending: false,
      error: '保存失败',
      options: { folders: ['生活', '技术'], tags: ['旅行', '读书'] },
      'onUpdate:tags': (value: string) => wrapper.setProps({ tags: value }),
    },
    attachTo: document.body,
    global: {
      stubs: {
        AdminActionBar: { template: '<div class="action-bar"><slot /></div>' },
        AdminBackLink: true,
        AdminMediaPicker: true,
        AdminContentRelations: true,
        ArticleMarkdown: true,
      },
    },
  })
  wrappers.push(wrapper)
  const button = (text: string) => wrapper.findAll('button').find((item) => item.text() === text)!
  return { wrapper, draft, button }
}

/** 去掉 scoped 样式标记与 useId 生成的标识，只比较结构、属性与文字 */
const markup = (html: string) =>
  html
    .replace(/ data-v-[a-f0-9]+(="")?/g, '')
    .replace(/v-[0-9a-z]+(-[0-9a-z]+)*/g, (id) => (/^v-(if|else|for|show)$/.test(id) ? id : '<id>'))

it('草稿：标签选项、阅读统计、搜索预览与发布检查内容', async () => {
  const { wrapper } = await setup()
  expect(markup(wrapper.html())).toMatchSnapshot()
})

it('已发布并有封面：撤回入口、封面预览与失败重试、地址标识', async () => {
  const { wrapper, button } = await setup({
    id: 12,
    slug: 'travel-notes',
    status: 'published',
    cover: '/cover.webp',
    coverAlt: '山路',
    seoTitle: '山间旅行',
    seoDescription: '一次徒步',
    seoNoindex: true,
    pinned: true,
  })
  expect(markup(wrapper.html())).toMatchSnapshot()
  await wrapper.get('.post-editor__cover-preview img').trigger('error')
  expect(markup(wrapper.get('.post-editor__cover-preview').html())).toMatchSnapshot()
  expect(wrapper.find('dialog').text()).toContain('封面')
  await button('撤回为草稿').trigger('click')
  expect(wrapper.emitted('save')).toEqual([['draft']])
})

it('添加已有标签、生成摘要、套用阅读时间并打开发布检查', async () => {
  const { wrapper, draft, button } = await setup()
  await button('读书').trigger('click')
  expect(wrapper.props('tags')).toBe('旅行, 摄影, 读书')
  expect(button('旅行').attributes('disabled')).toBeDefined()
  await button('从正文生成摘要').trigger('click')
  expect(draft.summary).not.toBe('')
  await wrapper.get('button[data-post-apply-reading-time]').trigger('click')
  expect(wrapper.get('p[role="status"][aria-label]').text()).not.toBe('')
  await wrapper.get('input[pattern]').setValue('  Travel-Notes ')
  await wrapper.get('input[pattern]').trigger('blur')
  expect(draft.slug).toBe('travel-notes')
  await button('发布文章').trigger('click')
  expect(wrapper.get<HTMLDialogElement>('dialog').element.open).toBe(true)
  expect(markup(wrapper.get('dialog').html())).toMatchSnapshot()
  expect(wrapper.emitted('reviewing')).toEqual([[true]])
})

it('说明文字、统计与文件夹候选的关联都指向页面中真实存在的元素', async () => {
  const { wrapper } = await setup()
  const described = wrapper.findAll('[aria-describedby]')
  expect(described.length).toBeGreaterThanOrEqual(3)
  for (const element of described)
    for (const id of element.attributes('aria-describedby')!.split(' '))
      expect(document.getElementById(id), id).not.toBeNull()
  const folder = wrapper.get('input[list]')
  expect(document.getElementById(folder.attributes('list')!)?.tagName).toBe('DATALIST')
})
