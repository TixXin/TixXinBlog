/** @file adminSaveShortcut.test.ts @description 后台编辑器 Ctrl/⌘+S：复用保存按钮提交，阻止浏览器保存网页，保存中、无改动、对话框打开时不重复提交 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, h, reactive, ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { isSaveShortcut, useAdminSaveShortcut } from '../../app/composables/useAdminSaveShortcut'
import PostEditor from '../../app/components/admin/PostEditor.vue'
import type { AdminPostDraft } from '../../app/features/post/adminTypes'

const toast = vi.hoisted(() => ({ info: vi.fn(), success: vi.fn(), error: vi.fn(), warning: vi.fn() }))
mockNuxtImport('useToast', () => () => toast)

const wrappers: { unmount(): void }[] = []
beforeEach(() => {
  Object.values(toast).forEach((mock) => mock.mockReset())
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  document.querySelectorAll('dialog').forEach((dialog) => dialog.remove())
})

function press(init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true, ...init })
  document.body.dispatchEvent(event)
  return event
}

async function setup(options: { disabled?: boolean; busy?: boolean; dirty?: boolean; enabled?: boolean } = {}) {
  const state = reactive({ disabled: false, busy: false, dirty: true, enabled: true, ...options })
  const submit = vi.fn()
  const Harness = defineComponent({
    setup() {
      const form = ref<HTMLFormElement | null>(null)
      const { label } = useAdminSaveShortcut({
        form,
        dirty: () => state.dirty,
        enabled: () => state.enabled,
      })
      return () =>
        h('form', { ref: form, onSubmit: (event: Event) => (event.preventDefault(), submit()) }, [
          h('input', { name: 'title' }),
          h(
            'button',
            { type: 'submit', disabled: state.disabled, 'aria-busy': String(state.busy) },
            `保存（${label.value}）`,
          ),
        ])
    },
  })
  const wrapper = await mountSuspended(Harness, { attachTo: document.body })
  wrappers.push(wrapper)
  return { state, submit, wrapper }
}

it('只识别 Ctrl/⌘+S，排除 Shift/Alt 组合与输入法合成', () => {
  expect(isSaveShortcut(new KeyboardEvent('keydown', { key: 's', ctrlKey: true }))).toBe(true)
  expect(isSaveShortcut(new KeyboardEvent('keydown', { key: 's', metaKey: true }))).toBe(true)
  expect(isSaveShortcut(new KeyboardEvent('keydown', { key: 'S', ctrlKey: true, shiftKey: true }))).toBe(false)
  expect(isSaveShortcut(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, altKey: true }))).toBe(false)
  expect(isSaveShortcut(new KeyboardEvent('keydown', { key: 's' }))).toBe(false)
  expect(isSaveShortcut(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, isComposing: true }))).toBe(false)
})

it('Ctrl+S 与 ⌘+S 都阻止浏览器默认保存，并通过保存按钮提交一次', async () => {
  const { submit } = await setup()
  const event = press()
  expect(event.defaultPrevented).toBe(true)
  expect(submit).toHaveBeenCalledTimes(1)
  press({ ctrlKey: false, metaKey: true })
  expect(submit).toHaveBeenCalledTimes(2)
  // 按住不放产生的重复按键不再提交。
  expect(press({ repeat: true }).defaultPrevented).toBe(true)
  expect(submit).toHaveBeenCalledTimes(2)
})

it('保存中（按钮禁用或 aria-busy）时只拦截默认行为，不重复提交', async () => {
  const { state, submit, wrapper } = await setup({ disabled: true })
  expect(press().defaultPrevented).toBe(true)
  state.disabled = false
  state.busy = true
  await wrapper.vm.$nextTick()
  press()
  expect(submit).not.toHaveBeenCalled()
})

it('无改动时提示而不提交；编辑器停用或模态对话框打开时不提交', async () => {
  const { state, submit, wrapper } = await setup({ dirty: false })
  press()
  expect(submit).not.toHaveBeenCalled()
  expect(toast.info).toHaveBeenCalledWith('当前没有需要保存的修改')
  state.dirty = true
  state.enabled = false
  await wrapper.vm.$nextTick()
  press()
  expect(submit).not.toHaveBeenCalled()
  state.enabled = true
  const dialog = document.createElement('dialog')
  dialog.setAttribute('open', '')
  document.body.append(dialog)
  press()
  expect(submit).not.toHaveBeenCalled()
  dialog.remove()
  press()
  expect(submit).toHaveBeenCalledTimes(1)
})

it('其他组合键不拦截；卸载后不再响应', async () => {
  const { submit, wrapper } = await setup()
  expect(press({ shiftKey: true }).defaultPrevented).toBe(false)
  wrapper.unmount()
  wrappers.pop()
  expect(press().defaultPrevented).toBe(false)
  expect(submit).not.toHaveBeenCalled()
})

it('文章编辑器：Ctrl+S 按当前状态保存草稿，无改动或保存中不提交，按钮带快捷键提示', async () => {
  const draft = reactive<AdminPostDraft>({
    title: '快捷键保存',
    summary: '',
    cover: '',
    folder: '前端开发',
    category: 'tech',
    status: 'draft',
    contentRaw: '正文',
    pinned: false,
    readTimeMinutes: 3,
    tags: [],
  })
  const wrapper = await mountSuspended(PostEditor, {
    props: { modelValue: draft, tags: '', pending: false, error: '', dirty: true },
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
  const save = wrapper.get('button[type="submit"]')
  expect(save.attributes('aria-keyshortcuts')).toBe('Control+S Meta+S')
  press()
  expect(wrapper.emitted('save')).toEqual([['draft']])
  await wrapper.setProps({ dirty: false })
  press()
  expect(wrapper.emitted('save')).toHaveLength(1)
  await wrapper.setProps({ dirty: true, pending: true })
  press()
  expect(wrapper.emitted('save')).toHaveLength(1)
})
