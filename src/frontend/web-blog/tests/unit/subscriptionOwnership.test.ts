/** @file subscriptionOwnership.test.ts @description 订阅编辑器失去账号、令牌或内容归属后私密 DOM 同步关闭，原副本仍可恢复 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import type { Ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import Editor from '../../app/components/subscription/Editor.vue'
import { subscriptionBody, subscriptionForm } from '../../app/features/subscription/editor'
const mocks = vi.hoisted(() => ({
  repo: { adminDetail: vi.fn(), save: vi.fn(), submission: vi.fn() },
  auth: {} as { currentUser: Ref<{ id: string } | null>; isLoggedIn: Ref<boolean>; restore: ReturnType<typeof vi.fn> },
}))
mockNuxtImport('useSubscriptionRepository', () => () => mocks.repo)
mockNuxtImport('useCurrentUser', () => () => mocks.auth)
const wrappers: { unmount(): void }[] = []
const hosts: HTMLElement[] = []
const item = {
  ...subscriptionBody(subscriptionForm()),
  id: 1,
  name: '私人账本',
  notes: '服务器私密备注',
  revision: 0,
  iconUrl: null,
  faviconUrl: null,
  publishedAt: null,
  createdAt: '2026-10-13T00:00:00.000Z',
  updatedAt: '2026-10-13T00:00:00.000Z',
  priceHistory: [],
}
beforeEach(() => {
  sessionStorage.clear()
  mocks.auth = { currentUser: ref({ id: 'owner' }), isLoggedIn: ref(true), restore: vi.fn().mockResolvedValue(true) }
  mocks.repo.adminDetail.mockReset().mockResolvedValue(item)
  mocks.repo.save.mockReset()
  mocks.repo.submission.mockReset()
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  hosts.splice(0).forEach((host) => host.remove())
  vi.restoreAllMocks()
})
async function setup() {
  let context!: Ref<string>
  const wrapper = await mountSuspended(
    defineComponent({
      setup() {
        context = useState('page-content-context')
        context.value = 'owned-library'
        return () => h(Editor, { id: 1 })
      },
    }),
    {
      global: { stubs: { AdminMediaPicker: true, SubscriptionHistory: true, Icon: true } },
    },
  )
  wrappers.push(wrapper)
  await vi.waitFor(() =>
    expect(wrapper.get('textarea[aria-label="订阅备注"]').element).toHaveProperty('value', '服务器私密备注'),
  )
  return { wrapper, context }
}
describe('订阅编辑私密可见性', () => {
  it.each(['logout', 'token', 'context'])('%s 失效隐藏表单、恢复和冲突面板，匹配归属恢复后输入仍在', async (kind) => {
    const { wrapper, context } = await setup()
    await wrapper.get('textarea[aria-label="订阅备注"]').setValue('本机未保存私密备注')
    mocks.repo.save.mockRejectedValueOnce(
      Object.assign(new Error('版本冲突'), { statusCode: 409, conflictKind: 'revision' }),
    )
    mocks.repo.adminDetail.mockResolvedValue({ ...item, notes: '另一版本私密备注', revision: 1 })
    const saveButton = wrapper.findAll('button').find((button) => button.text() === '保存订阅')!
    await saveButton.trigger('click')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('另一版本私密备注')
    if (kind === 'logout') mocks.auth.currentUser.value = null
    else if (kind === 'token') mocks.auth.isLoggedIn.value = false
    else context.value = 'other-library'
    await flushPromises()
    expect(wrapper.find('[aria-label="订阅编辑输入已锁定"]').exists()).toBe(true)
    expect(wrapper.find('textarea[aria-label="订阅备注"]').exists()).toBe(false)
    expect(wrapper.find('[aria-label="订阅服务器版本"]').exists()).toBe(false)
    expect(wrapper.find('[aria-label="订阅恢复副本"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('本机未保存私密备注')
    expect(wrapper.text()).not.toContain('另一版本私密备注')
    expect(sessionStorage.getItem('blog-subscription-editor:owner:1:owned-library')).toContain('本机未保存私密备注')
    mocks.auth.currentUser.value = { id: 'owner' }
    mocks.auth.isLoggedIn.value = true
    context.value = 'owned-library'
    await flushPromises()
    await vi.waitFor(() => expect(wrapper.find('[aria-label="订阅编辑输入已锁定"]').exists()).toBe(false))
    expect(wrapper.get('textarea[aria-label="订阅备注"]').element).toHaveProperty('value', '本机未保存私密备注')
  })
  it('另一账号不接纳旧账号迟到详情与副本', async () => {
    const { wrapper } = await setup()
    await wrapper.get('textarea[aria-label="订阅备注"]').setValue('原账号私密备注')
    mocks.repo.adminDetail.mockResolvedValue({ ...item, name: '新账号记录', notes: '新账号备注' })
    mocks.auth.currentUser.value = { id: 'another-owner' }
    await flushPromises()
    expect(wrapper.get('textarea[aria-label="订阅备注"]').element).toHaveProperty('value', '新账号备注')
    expect(wrapper.text()).not.toContain('原账号私密备注')
    expect(sessionStorage.getItem('blog-subscription-editor:owner:1:owned-library')).toContain('原账号私密备注')
  })
})

async function setupFocus(id: number | null) {
  const editor = ref<InstanceType<typeof Editor> | null>(null)
  const host = document.createElement('div')
  document.body.append(host)
  hosts.push(host)
  const wrapper = await mountSuspended(
    defineComponent({
      setup() {
        useState('page-content-context').value = 'owned-library'
        return () => h(Editor, { id, inline: true, ref: editor })
      },
    }),
    {
      attachTo: host,
      global: { stubs: { AdminMediaPicker: true, SubscriptionHistory: true, Icon: true } },
    },
  )
  wrappers.push(wrapper)
  return { editor, wrapper }
}

describe('订阅编辑入口焦点', () => {
  it('新建表单仅在页面显式请求后聚焦服务名称', async () => {
    const { editor, wrapper } = await setupFocus(null)
    await flushPromises()
    const input = wrapper.get('input[aria-label="服务名称"]').element
    expect(document.activeElement).not.toBe(input)
    editor.value!.focusName()
    await flushPromises()
    expect(document.activeElement).toBe(input)
  })
  it('等待详情就绪后才把焦点交给可编辑的名称字段', async () => {
    let finish!: (value: typeof item) => void
    mocks.repo.adminDetail.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const { editor, wrapper } = await setupFocus(1)
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
    editor.value!.focusName()
    await flushPromises()
    const input = wrapper.get('input[aria-label="服务名称"]').element
    expect(input.closest('fieldset')!.hasAttribute('disabled')).toBe(true)
    expect(document.activeElement).not.toBe(input)
    finish(item)
    await flushPromises()
    expect(input.closest('fieldset')!.hasAttribute('disabled')).toBe(false)
    expect(document.activeElement).toBe(input)
  })
  it('等待聚焦期间身份失效会取消请求，重新登录不会自行抢焦点', async () => {
    let finish!: (value: typeof item) => void
    mocks.repo.adminDetail.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const { editor, wrapper } = await setupFocus(1)
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
    editor.value!.focusName()
    mocks.auth.isLoggedIn.value = false
    await flushPromises()
    finish(item)
    await flushPromises()
    expect(wrapper.find('input[aria-label="服务名称"]').exists()).toBe(false)
    mocks.auth.isLoggedIn.value = true
    await flushPromises()
    const input = wrapper.get('input[aria-label="服务名称"]').element
    expect(document.activeElement).not.toBe(input)
  })
})
