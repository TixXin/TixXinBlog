/** @file tabIconPicker.test.ts @description 标签页图标选择器：初始标签页按当前值选择，Lucide 与 Emoji 的搜索与取值，上传图片的大小限制、读取结果与清除 */
import { afterEach, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import TabIconPicker from '../../app/components/tab/TabIconPicker.vue'

const wrappers: { unmount(): void }[] = []
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))

async function mountPicker(modelValue: string) {
  const wrapper = await mountSuspended(TabIconPicker, {
    props: { modelValue, 'onUpdate:modelValue': (value: string) => wrapper.setProps({ modelValue: value }) },
    global: { stubs: { Icon: true } },
  })
  wrappers.push(wrapper)
  return wrapper
}
/** 去掉 scoped 样式标记，只比较结构、属性与文字 */
const markup = (html: string) => html.replace(/ data-v-[a-f0-9]+(="")?/g, '')
const selectFile = async (wrapper: Awaited<ReturnType<typeof mountPicker>>, file: File) => {
  const input = wrapper.get('input[type="file"]')
  Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
  await input.trigger('change')
}

it('三个标签页的结构与初始标签页', async () => {
  const lucide = await mountPicker('lucide:star')
  const emoji = await mountPicker('🔥')
  const upload = await mountPicker('data:image/png;base64,AAAA')
  expect([markup(lucide.html()), markup(emoji.html()), markup(upload.html())]).toMatchSnapshot()
})

it('Lucide 按关键词、名称与翻译名搜索，Emoji 按关键词与字符搜索，点击取值', async () => {
  const wrapper = await mountPicker('lucide:star')
  const search = async (value: string) => {
    await wrapper.get('input[type="text"]').setValue(value)
    return wrapper.findAll('.icon-picker__item').map((item) => item.attributes('title'))
  }
  const trace: unknown[] = [await search('ai'), await search('BOOK'), await search('收藏'), await search('zzz')]
  trace.push(wrapper.find('.icon-picker__empty').text())
  await search('')
  await wrapper.findAll('.icon-picker__item')[2]!.trigger('click')
  trace.push(wrapper.emitted('update:modelValue'), wrapper.get('.icon-picker__item--active').attributes('title'))
  await wrapper.findAll('.icon-picker__tab')[1]!.trigger('click')
  trace.push(await search('猫'), await search('🔥'), await search('qqq'), wrapper.find('.icon-picker__empty').text())
  await search('')
  await wrapper.findAll('.icon-picker__item')[0]!.trigger('click')
  trace.push(wrapper.emitted('update:modelValue')?.at(-1))
  expect(trace).toMatchSnapshot()
})

it('上传：超过 32KB 提示大小，读取成功写入 dataURL 并可清除', async () => {
  const wrapper = await mountPicker('lucide:star')
  await wrapper.findAll('.icon-picker__tab')[2]!.trigger('click')
  await selectFile(wrapper, new File([new Uint8Array(40 * 1024)], 'big.png', { type: 'image/png' }))
  const tooLarge = wrapper.get('.icon-picker__upload-error').text()
  await selectFile(wrapper, new File([new Uint8Array([137, 80, 78, 71])], 'small.png', { type: 'image/png' }))
  await new Promise((resolve) => setTimeout(resolve, 20))
  await flushPromises()
  const value = wrapper.emitted('update:modelValue')?.at(-1)?.[0] as string
  expect({
    tooLarge,
    errorAfterSuccess: wrapper.find('.icon-picker__upload-error').exists(),
    value,
    preview: wrapper.get('.icon-picker__upload-preview img').attributes('src') === value,
  }).toMatchSnapshot()
  await wrapper.get('.icon-picker__upload-clear').trigger('click')
  expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([''])
  expect(wrapper.find('.icon-picker__upload-preview').exists()).toBe(false)
})

it('上传错误在切换标签页后仍保留', async () => {
  const wrapper = await mountPicker('lucide:star')
  await wrapper.findAll('.icon-picker__tab')[2]!.trigger('click')
  await selectFile(wrapper, new File([new Uint8Array(40 * 1024)], 'big.png', { type: 'image/png' }))
  await wrapper.findAll('.icon-picker__tab')[0]!.trigger('click')
  await wrapper.findAll('.icon-picker__tab')[2]!.trigger('click')
  expect(wrapper.get('.icon-picker__upload-error').text()).toContain('40KB')
})
