/** @file adminLinkApplications.test.ts @description 友链申请审核：确认后才通过或拒绝、通过记录草稿编号、开关携带须知版本且冲突时重读、条目按状态给出操作 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import LinkApplicationItem from '../../app/components/admin/LinkApplicationItem.vue'
import { useLinkApplicationActions } from '../../app/composables/useLinkApplicationActions'
import { useLinkApplicationSwitch } from '../../app/composables/useLinkApplicationSwitch'
import type { LinkApplication, LinkSettings } from '../../app/features/link/types'

const mocks = vi.hoisted(() => ({ approve: vi.fn(), reject: vi.fn(), saveSettings: vi.fn(), confirm: vi.fn() }))
mockNuxtImport('useLinkApplicationRepository', () => () => ({ approve: mocks.approve, reject: mocks.reject }))
mockNuxtImport('useLinkRepository', () => () => ({ saveSettings: mocks.saveSettings }))
mockNuxtImport('useCurrentUser', () => () => ({ currentUser: ref({ id: 'owner' }) }))
const wrappers: { unmount(): void }[] = []
const application: LinkApplication = {
  id: '0b6f6c1e-4f0a-4d55-9a4e-2f1d0c3b9a77',
  name: '松下问童子',
  url: 'https://pine.example.org/blog',
  domain: 'pine.example.org',
  description: '前端工程与读书笔记',
  contact: 'hi@pine.example.org',
  message: '希望能互换友链',
  status: 'pending',
  handledAt: null,
  createdLinkId: null,
  createdAt: '2026-10-20T08:00:00.000Z',
}
const settings: LinkSettings = { rules: ['保持原创'], applicationsEnabled: false, revision: 4, updatedAt: '' }

async function setup() {
  const list = {
    pending: ref(false),
    error: ref(''),
    notice: ref(''),
    settings: ref<LinkSettings | null>({ ...settings }),
    load: vi.fn().mockResolvedValue(undefined),
  }
  let result!: ReturnType<typeof useLinkApplicationActions> & ReturnType<typeof useLinkApplicationSwitch>
  wrappers.push(
    await mountSuspended(
      defineComponent({
        setup() {
          result = { ...useLinkApplicationActions(list), ...useLinkApplicationSwitch(list) }
          return () => h('div')
        },
      }),
    ),
  )
  return { list, ...result }
}
beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset())
  mocks.confirm.mockReturnValue(true)
  vi.stubGlobal('confirm', mocks.confirm)
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.unstubAllGlobals()
})

describe('友链申请审核操作', () => {
  it('通过后记录草稿编号、提示并重新读取列表', async () => {
    mocks.approve.mockResolvedValueOnce({ application, link: { id: 58 } })
    const { decide, approvedLinks, list, busy } = await setup()
    await decide(application, 'approve')
    expect(mocks.approve).toHaveBeenCalledWith(application.id)
    expect(approvedLinks.value).toEqual({ [application.id]: 58 })
    expect(list.notice.value).toContain('松下问童子')
    expect(list.load).toHaveBeenCalledTimes(1)
    expect(busy.value).toEqual([])
  })

  it('取消确认时不发请求；拒绝失败时展示文案且不重读', async () => {
    const { decide, list } = await setup()
    mocks.confirm.mockReturnValueOnce(false)
    await decide(application, 'reject')
    expect(mocks.reject).not.toHaveBeenCalled()
    mocks.reject.mockRejectedValueOnce(new Error('该申请已处理，请刷新后查看当前状态'))
    await decide(application, 'reject')
    expect(list.error.value).toBe('该申请已处理，请刷新后查看当前状态')
    expect(list.load).not.toHaveBeenCalled()
  })

  it('开关保存时携带当前须知与版本，成功后更新设置', async () => {
    mocks.saveSettings.mockResolvedValueOnce({ ...settings, applicationsEnabled: true, revision: 5 })
    const { toggle, list } = await setup()
    await toggle()
    expect(mocks.saveSettings).toHaveBeenCalledWith({ rules: ['保持原创'], revision: 4, applicationsEnabled: true })
    expect(list.settings.value).toMatchObject({ applicationsEnabled: true, revision: 5 })
    expect(list.notice.value).not.toBe('')
  })

  it('开关遇到版本冲突时提示并重新读取，不重试覆盖', async () => {
    mocks.saveSettings.mockRejectedValueOnce(Object.assign(new Error('友链规则已变化'), { statusCode: 409 }))
    const { toggle, list, toggling } = await setup()
    await toggle()
    expect(list.error.value).toBe('友链规则已变化')
    expect(list.load).toHaveBeenCalledTimes(1)
    expect(mocks.saveSettings).toHaveBeenCalledTimes(1)
    expect(toggling.value).toBe(false)
  })
})

describe('友链申请条目', () => {
  async function item(props: Partial<InstanceType<typeof LinkApplicationItem>['$props']> = {}) {
    const wrapper = await mountSuspended(LinkApplicationItem, {
      props: { item: application, disabled: false, focused: false, linkId: null, ...props },
    })
    wrappers.push(wrapper)
    return wrapper
  }

  it('待审申请展示联系方式与附言，并提供通过和拒绝', async () => {
    const wrapper = await item()
    expect(wrapper.text()).toContain('hi@pine.example.org')
    expect(wrapper.text()).toContain('希望能互换友链')
    expect(wrapper.find('a[href="https://pine.example.org/blog"]').attributes('rel')).toContain('nofollow')
    const buttons = wrapper.findAll('button')
    expect(buttons).toHaveLength(2)
    await buttons[0]!.trigger('click')
    await buttons[1]!.trigger('click')
    expect(wrapper.emitted('approve')?.[0]).toEqual([application])
    expect(wrapper.emitted('reject')?.[0]).toEqual([application])
  })

  it('已通过的申请只给出编辑草稿入口', async () => {
    const wrapper = await item({ item: { ...application, status: 'approved', createdLinkId: 31 }, linkId: 31 })
    await flushPromises()
    expect(wrapper.findAll('button')).toHaveLength(0)
    expect(wrapper.find('a[href="/admin/links/31"]').exists()).toBe(true)
  })
})
