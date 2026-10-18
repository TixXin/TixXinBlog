/** @file momentForm.test.ts @description 动态表单的必填约束、事件载荷、引用切换和冲突输入保护 */
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import MomentForm from '../../app/components/admin/MomentForm.vue'
import { momentForm } from '../../app/features/moment/editor'
import type { ManagedMoment, MomentEditable } from '../../app/features/moment/types'

const SlotStub = defineComponent({
  setup:
    (_, { slots }) =>
    () =>
      h('div', slots.default?.()),
})
const MediaPickerStub = defineComponent({
  props: ['open'],
  emits: ['selected', 'update:open'],
  setup: () => () => h('div'),
})
const wrappers: { unmount(): void }[] = []
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))

async function setup(patch: Partial<InstanceType<typeof MomentForm>['$props']> = {}) {
  const wrapper = await mountSuspended(MomentForm, {
    attachTo: document.body,
    props: {
      value: { ...momentForm(), content: '晚风吹过河岸' },
      id: null,
      ready: true,
      loading: false,
      saving: false,
      dirty: true,
      saved: null,
      serverVersion: null,
      recovery: null,
      error: '',
      notice: '',
      localError: '',
      articleChoices: [],
      articlesPending: false,
      articlesError: '',
      ...patch,
    },
    global: {
      stubs: {
        AdminBackLink: true,
        NuxtLink: true,
        AdminActionBar: SlotStub,
        CommonTooltip: SlotStub,
        ClientOnly: SlotStub,
        AdminMediaPicker: MediaPickerStub,
      },
    },
  })
  wrappers.push(wrapper)
  return wrapper
}

type Wrapper = Awaited<ReturnType<typeof setup>>
function button(wrapper: Wrapper, text: string) {
  return wrapper.findAll('button').find((item) => item.text() === text)!
}
function inputByLabel(wrapper: Wrapper, text: string) {
  return wrapper
    .findAll('label')
    .find((item) => item.text() === text)!
    .get('input')
}
function currentValue(patch: Partial<MomentEditable> = {}): MomentEditable {
  return { ...momentForm(), content: '晚风吹过河岸', ...patch }
}

describe('动态表单', () => {
  it.each(['', ' \n '])('正文为 %j 时禁止所有保存动作并保留原生必填语义', async (content) => {
    const wrapper = await setup({ value: currentValue({ content }) })
    const textarea = wrapper.get<HTMLTextAreaElement>('[aria-label="动态正文"]')
    expect(textarea.element.required).toBe(true)
    expect(textarea.element.maxLength).toBe(10000)
    expect(textarea.element.closest('label')?.textContent).toContain('动态正文')
    if (!content) expect(textarea.element.validity.valueMissing).toBe(true)
    for (const text of ['保存动态', '保存草稿', '发布动态']) {
      const action = button(wrapper, text)
      expect((action.element as HTMLButtonElement).disabled).toBe(true)
      await action.trigger('click')
    }
    expect(wrapper.emitted('save')).toBeUndefined()
  })

  it.each([{ ready: false }, { loading: true }, { saving: true }])('%j 时禁止重复保存', async (state) => {
    const wrapper = await setup(state)
    const actions = wrapper.findAll('.moment-editor__actions button')
    expect(actions).toHaveLength(3)
    for (const action of actions) {
      expect((action.element as HTMLButtonElement).disabled).toBe(true)
      await action.trigger('click')
    }
    expect(wrapper.get('button[type="submit"]').attributes('aria-busy')).toBe(String(!!state.saving))
    expect(wrapper.get<HTMLFieldSetElement>('fieldset').element.disabled).toBe(!!state.loading || state.ready === false)
    expect(wrapper.emitted('save')).toBeUndefined()
  })

  it('正文、话题、地点与置顶只发出对应字段的局部载荷，不修改传入数据', async () => {
    const value = currentValue({ topics: ['散步'] })
    const before = structuredClone(value)
    const wrapper = await setup({ value })
    await wrapper.get('[aria-label="动态正文"]').setValue('记录一段新的散步路线')
    await wrapper.get('[aria-label="动态话题"]').setValue(' #散步， ##摄影, , 日常 ')
    await inputByLabel(wrapper, '地点').setValue('河岸')
    await inputByLabel(wrapper, '设备').setValue('随身相机')
    await inputByLabel(wrapper, '心情').setValue('轻松')
    await wrapper.get('input[type="checkbox"]').setValue(true)
    await wrapper.get('[aria-label="动态保存状态"]').setValue('archived')
    expect(wrapper.emitted('change')).toEqual([
      [{ content: '记录一段新的散步路线' }],
      [{ topics: ['散步', '摄影', '日常'] }],
      [{ location: '河岸' }],
      [{ device: '随身相机' }],
      [{ mood: '轻松' }],
      [{ isPinned: true }],
      [{ status: 'archived' }],
    ])
    expect(value).toEqual(before)
    expect(wrapper.emitted('save')).toBeUndefined()
  })

  it.each(['draft', 'published', 'archived'] as const)('主提交保留 %s 状态，显式按钮仅发出目标状态', async (status) => {
    const wrapper = await setup({ value: currentValue({ status }) })
    wrapper
      .get<HTMLFormElement>('form')
      .element.requestSubmit(wrapper.get<HTMLButtonElement>('[type="submit"]').element)
    await button(wrapper, '保存草稿').trigger('click')
    await button(wrapper, '发布动态').trigger('click')
    expect(wrapper.emitted('save')).toEqual([[status], ['draft'], ['published']])
    expect(wrapper.emitted('change')).toBeUndefined()
  })

  it.each(['ctrlKey', 'metaKey'] as const)('%s 保存快捷键复用当前状态，保存中不重复提交', async (modifier) => {
    const wrapper = await setup({ value: currentValue({ status: 'archived' }) })
    const press = () => {
      const event = new KeyboardEvent('keydown', { key: 's', [modifier]: true, bubbles: true, cancelable: true })
      wrapper.get('textarea').element.dispatchEvent(event)
      return event
    }
    expect(press().defaultPrevented).toBe(true)
    expect(wrapper.emitted('save')).toEqual([['archived']])
    await wrapper.setProps({ saving: true })
    press()
    expect(wrapper.emitted('save')).toHaveLength(1)
    expect(wrapper.get('[type="submit"]').attributes('aria-keyshortcuts')).toBe('Control+S Meta+S')
  })

  it('切换引用类型同时清除互斥字段，文章选择转换为数字编号并可清空', async () => {
    const value = currentValue({ linkedLink: { url: 'https://example.com/walk', title: '散步手记' } })
    const wrapper = await setup({ value, articleChoices: [{ id: 42, title: '河边的黄昏' }] })
    await wrapper.get('[aria-label="动态引用类型"]').setValue('article')
    expect(wrapper.emitted('change')).toEqual([[{ linkedArticleId: null, linkedLink: null }]])
    expect(wrapper.emitted('search-articles')).toEqual([['']])
    await wrapper.setProps({ value: { ...value, linkedLink: null } })
    await wrapper.get('[aria-label="搜索引用文章"]').setValue('黄昏')
    expect(wrapper.emitted('search-articles')?.at(-1)).toEqual(['黄昏'])
    await wrapper.get('[aria-label="引用文章"]').setValue('42')
    expect(wrapper.emitted('change')?.at(-1)).toEqual([{ linkedArticleId: 42 }])
    await wrapper.get('[aria-label="引用文章"]').setValue('')
    expect(wrapper.emitted('change')?.at(-1)).toEqual([{ linkedArticleId: null }])
    await wrapper.get('[aria-label="动态引用类型"]').setValue('link')
    expect(wrapper.emitted('change')?.at(-1)).toEqual([{ linkedArticleId: null, linkedLink: { url: '', title: '' } }])
    await wrapper.get('[aria-label="动态引用类型"]').setValue('none')
    expect(wrapper.emitted('change')?.at(-1)).toEqual([{ linkedArticleId: null, linkedLink: null }])
    expect(value.linkedLink).toEqual({ url: 'https://example.com/walk', title: '散步手记' })
  })

  it('修改外链字段保留完整卡片内容，不合法地址阻止所有保存入口', async () => {
    const linkedLink = {
      url: 'https://example.com/walk',
      title: '散步手记',
      description: '沿河散步',
      siteName: '个人手记',
      image: 'https://example.com/river.webp',
      favicon: 'https://example.com/icon.webp',
    }
    const wrapper = await setup({ value: currentValue({ linkedLink }) })
    await wrapper.get('[aria-label="引用链接标题"]').setValue('黄昏散步手记')
    expect(wrapper.emitted('change')).toEqual([[{ linkedLink: { ...linkedLink, title: '黄昏散步手记' } }]])
    await wrapper.get('[aria-label="引用链接地址"]').setValue('不是网址')
    expect(wrapper.emitted('change')?.at(-1)).toEqual([{ linkedLink: { ...linkedLink, url: '不是网址' } }])
    expect(wrapper.get<HTMLInputElement>('[aria-label="引用链接地址"]').element.validity.typeMismatch).toBe(true)
    wrapper.get<HTMLFormElement>('form').element.requestSubmit()
    await button(wrapper, '保存草稿').trigger('click')
    await button(wrapper, '发布动态').trigger('click')
    expect(wrapper.emitted('save')).toBeUndefined()
    expect(linkedLink.title).toBe('散步手记')
  })

  it('配图事件只采用地址，忽略重复与超过九张的选择，并允许按位置移除', async () => {
    const value = currentValue({ images: ['/river.webp'] })
    const wrapper = await setup({ value })
    const picker = wrapper.getComponent(MediaPickerStub)
    picker.vm.$emit('selected', { id: 'media-id', url: '/sunset.webp', storageKey: '不属于表单的字段' })
    expect(wrapper.emitted('change')).toEqual([[{ images: ['/river.webp', '/sunset.webp'] }]])
    picker.vm.$emit('selected', { url: '/river.webp' })
    expect(wrapper.emitted('change')).toHaveLength(1)
    await wrapper.get('[aria-label="移除配图 1"]').trigger('click')
    expect(wrapper.emitted('change')?.at(-1)).toEqual([{ images: [] }])
    const images = Array.from({ length: 9 }, (_, index) => `/photo-${index}.webp`)
    await wrapper.setProps({ value: { ...value, images } })
    expect((button(wrapper, '选择或上传图片').element as HTMLButtonElement).disabled).toBe(true)
    picker.vm.$emit('selected', { url: '/tenth.webp' })
    expect(wrapper.emitted('change')).toHaveLength(2)
    expect(value.images).toEqual(['/river.webp'])
  })

  it('冲突和搜索错误以警报显示，服务器版本不会覆盖当前输入，载入需要显式操作', async () => {
    const value = currentValue({ linkedArticleId: 42 })
    const wrapper = await setup({ value })
    const serverVersion: ManagedMoment = {
      id: 'moment-42',
      content: '服务器上的另一段记录',
      status: 'published',
      revision: 7,
      topics: ['摄影'],
      linkedArticleId: null,
      createdAt: '2026-10-10',
      updatedAt: '2026-10-18',
      date: '2026-10-10',
      likes: 0,
      isLiked: false,
    }
    await wrapper.setProps({ error: '版本冲突，请核对服务器内容', serverVersion, articlesError: '文章搜索失败' })
    expect(wrapper.findAll('[role="alert"]').map((item) => item.text())).toEqual([
      '版本冲突，请核对服务器内容 重新读取',
      '文章搜索失败',
    ])
    const comparison = wrapper.get('[aria-label="动态服务器版本"]')
    expect(comparison.text()).toContain('服务器当前版本 7')
    expect(comparison.text()).toContain('已发布 · 摄影')
    expect(comparison.get('blockquote').text()).toBe(serverVersion.content)
    expect(wrapper.get<HTMLTextAreaElement>('[aria-label="动态正文"]').element.value).toBe(value.content)
    expect(wrapper.emitted('change')).toBeUndefined()
    expect(wrapper.emitted('save')).toBeUndefined()
    expect(wrapper.emitted('reload')).toBeUndefined()
    await button(wrapper, '保留副本并载入服务器版本').trigger('click')
    expect(wrapper.emitted('reload')).toEqual([[]])
    expect(wrapper.get<HTMLTextAreaElement>('[aria-label="动态正文"]').element.value).toBe(value.content)
  })

  it('恢复副本与本机保存失败独立呈现，重试、恢复和移除只发出对应事件', async () => {
    const wrapper = await setup({
      localError: '浏览器存储空间不足',
      notice: '输入仍保留在当前窗口',
      recovery: {
        version: 1,
        id: null,
        revision: null,
        requestId: '12345678-1234-4123-a123-123456789abc',
        savedAt: '2026-10-18',
        form: currentValue({ content: '之前未保存的输入' }),
      },
    })
    expect(wrapper.get('[role="alert"]').text()).toContain('浏览器存储空间不足')
    expect(wrapper.get('[role="status"]').text()).toBe('输入仍保留在当前窗口')
    expect(wrapper.get('[aria-label="动态恢复副本"]').text()).toContain('之前未保存的输入')
    for (const [text, event] of [
      ['重试保存恢复副本', 'persist'],
      ['恢复输入', 'restore'],
      ['移除恢复副本', 'discard'],
    ]) {
      await button(wrapper, text!).trigger('click')
      expect(wrapper.emitted(event!)).toEqual([[]])
    }
    expect(wrapper.emitted('save')).toBeUndefined()
    expect(wrapper.emitted('change')).toBeUndefined()
  })
})
