/**
 * @file adminGalleryLinkI18n.test.ts
 * @description 后台图库与友链的英文冒烟：作品表单、友链表单、恢复副本详情与友链状态名称随界面语言切换，
 *              切回中文后文案保持原样
 * @author TixXin
 * @since 2026-10-19
 */

import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import GalleryForm from '../../app/components/admin/GalleryForm.vue'
import GalleryRecoveryDetails from '../../app/components/admin/GalleryRecoveryDetails.vue'
import LinkEditorForm from '../../app/components/admin/LinkEditorForm.vue'
import LinkRecoveryDetails from '../../app/components/admin/LinkRecoveryDetails.vue'
import { galleryForm } from '../../app/features/gallery/editor'
import { linkForm } from '../../app/features/link/editor'
import { linkStatusLabel, linkStatuses } from '../../app/features/link/types'

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  auth: {} as { currentUser: ReturnType<typeof ref<{ id: string } | null>> },
}))
mockNuxtImport('useAdminApi', () => () => mocks.api)
mockNuxtImport('useCurrentUser', () => () => mocks.auth)

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

const slotStub = defineComponent({
  setup:
    (_props, { slots }) =>
    () =>
      h('div', slots.default?.()),
})
const emptyStub = defineComponent({ setup: () => () => h('div') })
const stubs = {
  AdminBackLink: slotStub,
  AdminActionBar: slotStub,
  CommonTooltip: slotStub,
  CommonImageFrame: emptyStub,
  AdminMediaPicker: emptyStub,
  AdminContentRelations: emptyStub,
  ClientOnly: slotStub,
}
const baseProps = {
  id: null,
  saved: null,
  serverVersion: null,
  recovery: null,
  previousRecoveries: [],
  ready: true,
  loading: false,
  saving: false,
  dirty: true,
  error: '',
  notice: '',
  localError: '',
}

const wrappers: { unmount(): void }[] = []
beforeEach(() => {
  mocks.auth = { currentUser: ref({ id: 'owner' }) }
  mocks.api
    .mockReset()
    .mockImplementation(async (path: string) => (path.endsWith('/resolve') ? [] : { items: [], total: 0 }))
})
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))

describe('后台图库与友链英文冒烟', () => {
  it('友链状态名称按语言取值', async () => {
    const t = (key: string) => i18n().t(key)
    expect(linkStatuses.map((status) => linkStatusLabel(status, t))).toEqual(['草稿', '已上架', '已下架'])
    await inEnglish(() => {
      expect(linkStatuses.map((status) => linkStatusLabel(status, t))).toEqual(['Draft', 'Published', 'Unpublished'])
    })
  })

  it('作品表单的标题、字段、外链校验与保存按钮切换为英文', async () => {
    await inEnglish(async () => {
      const wrapper = await mountSuspended(GalleryForm, {
        props: {
          ...baseProps,
          value: { ...galleryForm(), source: 'external', externalUrl: 'ftp://example.com/a.png' },
        },
        global: { stubs },
      })
      wrappers.push(wrapper)
      const text = wrapper.text()
      expect(text).toContain('New photo')
      expect(text).toContain('Image source')
      expect(text).toContain('Use a full HTTP(S) URL')
      expect(wrapper.get('[aria-label="Title"]').exists()).toBe(true)
      expect(wrapper.findAll('button').map((button) => button.text())).toEqual(
        expect.arrayContaining(['Save photo', 'Save draft', 'Publish']),
      )
      expect(text).not.toMatch(/[一-鿿]/)
    })
  })

  it('友链表单切换为英文，切回中文后文案保持原样', async () => {
    await inEnglish(async () => {
      const wrapper = await mountSuspended(LinkEditorForm, {
        props: { ...baseProps, id: 7, value: linkForm({ name: 'Notes', url: 'https://example.com' }) },
        global: { stubs },
      })
      wrappers.push(wrapper)
      const text = wrapper.text()
      expect(text).toContain('Edit link')
      expect(text).toContain('Logo (optional)')
      expect(wrapper.get('[aria-label="Link site URL"]').exists()).toBe(true)
      expect(wrapper.findAll('option').map((option) => option.text())).toEqual(['Draft', 'Published', 'Unpublished'])
      expect(text).not.toMatch(/[一-鿿]/)
    })
    const zh = await mountSuspended(LinkEditorForm, {
      props: { ...baseProps, value: linkForm() },
      global: { stubs },
    })
    wrappers.push(zh)
    expect(zh.text()).toContain('新建友链')
    expect(zh.get('[aria-label="友链站点地址"]').exists()).toBe(true)
  })

  it('恢复副本详情的字段名与缺省值切换为英文', async () => {
    await inEnglish(async () => {
      const gallery = await mountSuspended(GalleryRecoveryDetails, { props: { value: galleryForm() } })
      const link = await mountSuspended(LinkRecoveryDetails, { props: { value: linkForm() } })
      wrappers.push(gallery, link)
      expect(gallery.text()).toContain('Retained external image URL')
      expect(gallery.text()).toContain('Uncategorized')
      expect(link.text()).toContain('Status / featured / sort value')
      expect(link.text()).toContain('Not featured')
    })
  })
})
