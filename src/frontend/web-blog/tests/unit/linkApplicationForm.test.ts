/** @file linkApplicationForm.test.ts @description 公开友链申请表单：有效后才能提交，成功只展示申请编号，失败保留输入并播报后端文案 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import LinkApplicationForm from '../../app/components/link/LinkApplicationForm.vue'

const mocks = vi.hoisted(() => ({ apply: vi.fn() }))
mockNuxtImport('useLinkApplicationRepository', () => () => ({ apply: mocks.apply }))
const wrappers: { unmount(): void }[] = []
const requestId = '0b6f6c1e-4f0a-4d55-9a4e-2f1d0c3b9a77'

async function mount() {
  const wrapper = await mountSuspended(LinkApplicationForm)
  wrappers.push(wrapper)
  return wrapper
}
async function fill(wrapper: Awaited<ReturnType<typeof mount>>) {
  const inputs = wrapper.findAll('fieldset input')
  await inputs[0]!.setValue('松下问童子')
  await inputs[1]!.setValue('https://pine.example.org/blog')
  await inputs[3]!.setValue('hi@pine.example.org')
  await wrapper.find('textarea').setValue('常读贵站的部署笔记')
}
beforeEach(() => mocks.apply.mockReset())
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))

describe('公开友链申请表单', () => {
  it('名称与地址有效前不能提交', async () => {
    const wrapper = await mount()
    const submit = wrapper.find('button[type="submit"]')
    expect(submit.attributes('disabled')).toBeDefined()
    await wrapper.findAll('fieldset input')[0]!.setValue('松下问童子')
    await wrapper.findAll('fieldset input')[1]!.setValue('pine.example.org')
    expect(submit.attributes('disabled')).toBeDefined()
    await wrapper.findAll('fieldset input')[1]!.setValue('https://pine.example.org')
    expect(submit.attributes('disabled')).toBeUndefined()
  })

  it('提交去空白的字段与防垃圾字段，成功后只展示申请编号', async () => {
    mocks.apply.mockResolvedValueOnce({ requestId })
    const wrapper = await mount()
    await fill(wrapper)
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(mocks.apply).toHaveBeenCalledWith(
      expect.objectContaining({
        name: '松下问童子',
        url: 'https://pine.example.org/blog',
        description: '',
        contact: 'hi@pine.example.org',
        message: '常读贵站的部署笔记',
        website: '',
        formElapsedMs: expect.any(Number),
      }),
    )
    expect(wrapper.find('[role="status"] code').text()).toBe(requestId)
    expect(wrapper.find('form').exists()).toBe(false)
    await wrapper.find('[role="status"] button').trigger('click')
    expect((wrapper.findAll('fieldset input')[0]!.element as HTMLInputElement).value).toBe('')
  })

  it('失败时保留输入并播报后端文案', async () => {
    mocks.apply.mockRejectedValueOnce(new Error('该地址已有一条待审核的申请，请耐心等待博主处理'))
    const wrapper = await mount()
    await fill(wrapper)
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.find('[role="alert"]').text()).toBe('该地址已有一条待审核的申请，请耐心等待博主处理')
    expect((wrapper.findAll('fieldset input')[1]!.element as HTMLInputElement).value).toBe(
      'https://pine.example.org/blog',
    )
    expect(wrapper.find('[role="status"] code').exists()).toBe(false)
  })
})
