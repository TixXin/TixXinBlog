/**
 * @file adminPostsI18n.test.ts
 * @description 后台文章域英文冒烟：编辑器、发布前检查与替代文本警告、批量确认面板、版本比较和图片上传提示
 *              在英文界面下切换为英文；离开确认与发布检查的中文与原文逐字一致
 * @author TixXin
 * @since 2026-10-19
 */

import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it } from 'vitest'
import { reactive } from 'vue'
import PostBatch from '../../app/components/admin/PostBatch.vue'
import PostConflict from '../../app/components/admin/PostConflict.vue'
import PostEditor from '../../app/components/admin/PostEditor.vue'
import { prepareImageFiles } from '../../app/composables/useAdminMarkdownImageUpload'
import type { AdminPostDraft } from '../../app/features/post/adminTypes'
import type { PostBatchPreview } from '../../app/features/post/batchTypes'

// 按原文读取中文字典（?raw 绕过 i18n 插件的预编译）
const zhDictionary = JSON.parse(
  Object.values(
    import.meta.glob<string>('../../i18n/locales/zh-CN/admin-content.json', {
      eager: true,
      query: '?raw',
      import: 'default',
    }),
  )[0]!,
) as Record<string, unknown>

function leaf(key: string) {
  return key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], zhDictionary)
}

/** 用到时再取：收集阶段 Nuxt 测试应用尚未就绪 */
const i18n = () => useNuxtApp().$i18n

async function inEnglish(run: () => void | Promise<void>) {
  await i18n().setLocale('en')
  try {
    await run()
  } finally {
    await i18n().setLocale('zh-CN')
  }
}

const currentT = () => (key: string, params?: Record<string, unknown>) =>
  params ? i18n().t(key, params) : i18n().t(key)

const wrappers: { unmount(): void }[] = []
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
})

function draft(values: Partial<AdminPostDraft> = {}) {
  return reactive<AdminPostDraft>({
    title: '旅行记录',
    summary: '山间的一天',
    cover: '/cover.webp',
    folder: '生活',
    category: 'life',
    status: 'draft',
    contentRaw: '![](/missing.webp)',
    pinned: false,
    readTimeMinutes: 3,
    tags: [],
    ...values,
  })
}

async function mountEditor() {
  const wrapper = await mountSuspended(PostEditor, {
    props: { modelValue: draft(), tags: '', pending: false, error: '' },
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
  return wrapper
}

const batchPreview: PostBatchPreview = {
  ticket: '44cda222-1d97-45b6-98d9-ebafbdcb724d',
  action: 'delete',
  allowedCount: 1,
  expiresIn: 600,
  items: [
    {
      id: 8,
      revision: 3,
      title: '秋日散步',
      allowed: true,
      reason: '',
      impact: { comments: 1, commentLikes: 0, revisions: 3, addresses: 1, mediaReferences: 2, likes: 5, views: 30 },
    },
  ],
}

async function mountBatch() {
  const wrapper = await mountSuspended(PostBatch, {
    props: {
      open: false,
      acknowledgement: '',
      preview: batchPreview,
      result: null,
      pending: false,
      error: '',
      attempted: false,
    },
  })
  wrappers.push(wrapper)
  return wrapper
}

describe('后台文章域中文原文', () => {
  it('离开确认与发布检查的中文与原文逐字一致', () => {
    expect(leaf('admin-content.postSave.leaveConfirm')).toBe('有尚未保存的内容，确定离开吗？')
    expect(leaf('admin-content.postEditor.publishCheck')).toBe('发布前检查')
    expect(leaf('admin-content.postEditor.altImage')).toBe('正文第 {image} 张图片（第 {line} 行）缺少替代文本。')
    expect(leaf('admin-content.postEditor.publishAnyway')).toBe('仍然公开发布')
    expect(leaf('admin-content.postEditor.confirmPublish')).toBe('确认公开发布')
  })

  it('默认中文下批量面板保留原有影响说明', async () => {
    const wrapper = await mountBatch()
    expect(wrapper.text()).toContain('操作：永久删除。本次明确选择 1 篇，可执行 1 篇。')
    expect(wrapper.text()).toContain(
      '1 条评论 · 3 个修订 · 1 个地址 · 2 条媒体引用 · 5 条文章点赞 · 0 条评论点赞 · 30 条访问去重记录',
    )
    expect(wrapper.text()).toContain('输入“永久删除”确认')
  })
})

describe('后台文章域英文冒烟', () => {
  it('编辑器与发布前检查、替代文本警告切换为英文', async () => {
    await inEnglish(async () => {
      const wrapper = await mountEditor()
      const publish = wrapper.findAll('button').find((item) => item.text() === 'Publish')
      expect(publish).toBeTruthy()
      expect(wrapper.text()).toContain('Status: Draft')
      expect(wrapper.text()).toContain('Post URL & SEO')
      await publish!.trigger('click')
      const dialog = wrapper.get('dialog.post-editor__publish')
      expect(dialog.get('#publish-check-title').text()).toBe('Pre-publish check')
      expect(dialog.findAll('li').map((item) => item.text())).toEqual([
        'The cover has no alt text. Fill in “Cover alt text”.',
        'Image 1 in the body (line 1) has no alt text.',
      ])
      expect(dialog.text()).toContain('Publish anyway')
      // 除博主填写的标题、摘要、专栏外不应残留中文
      const text = dialog.text().replace(/旅行记录|山间的一天|生活/g, '')
      expect(text).not.toMatch(/[一-鿿]/)
    })
  })

  it('批量确认面板按数量使用英文单复数，确认文字仍是后端要求的原文', async () => {
    await inEnglish(async () => {
      const wrapper = await mountBatch()
      expect(wrapper.text()).toContain('Action: Delete permanently. Selected: 1; can be processed: 1.')
      expect(wrapper.text()).toContain(
        '1 comment · 3 revisions · 1 URL · 2 media references · 5 post likes · 0 comment likes · 30 view records',
      )
      expect(wrapper.text()).toContain('Type “永久删除” (delete permanently) to confirm')
    })
  })

  it('版本比较的默认标题与按钮随语言变化，调用方传入的文案优先', async () => {
    await inEnglish(async () => {
      const local = draft({ revision: 2, contentRaw: 'a' })
      const server = draft({ revision: 3, contentRaw: 'b' })
      const wrapper = await mountSuspended(PostConflict, { props: { local, server } })
      wrappers.push(wrapper)
      expect(wrapper.get('h2').text()).toBe('The server has newer changes')
      expect(wrapper.text()).toContain('Your input · revision 2')
      expect(wrapper.text()).toContain('Load the server version and set aside your input')
      await wrapper.setProps({ title: '自定义标题' })
      expect(wrapper.get('h2').text()).toBe('自定义标题')
    })
  })

  it('图片上传的拒绝原因随传入语言变化，缺省读取当前界面语言', async () => {
    const files = [new File(['x'], 'a.gif', { type: 'image/gif' })]
    expect(prepareImageFiles(files, currentT()).rejected[0]!.reason).toBe('仅支持 JPEG、PNG 和 WebP 图片')
    await inEnglish(() => {
      expect(prepareImageFiles(files, currentT()).rejected[0]!.reason).toBe(
        'Only JPEG, PNG and WebP images are supported',
      )
    })
  })
})
