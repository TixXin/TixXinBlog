/** @file searchHighlight.test.ts @description 关键词高亮的文本保真、安全渲染与响应式更新。 */
import { afterEach, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import SearchHighlight from '../../app/components/common/SearchHighlight.vue'

const wrappers: { unmount(): void }[] = []
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))

it('重复命中保留大小写与文字间距，更新关键词后同步刷新', async () => {
  const wrapper = mount(SearchHighlight, { props: { text: 'Vue 与 vue 组件', keyword: ' VUE ' } })
  wrappers.push(wrapper)
  expect(wrapper.text()).toBe('Vue 与 vue 组件')
  expect(wrapper.findAll('mark').map((mark) => mark.text())).toEqual(['Vue', 'vue'])
  await wrapper.setProps({ keyword: '组件' })
  expect(wrapper.findAll('mark').map((mark) => mark.text())).toEqual(['组件'])
  await wrapper.setProps({ keyword: '' })
  expect(wrapper.findAll('mark')).toHaveLength(0)
  expect(wrapper.text()).toBe('Vue 与 vue 组件')
})

it('HTML 和关键词始终作为文本，命中前后均不能注入元素', () => {
  const text = '<img src=x onerror=alert(1)> <script>alert(1)</script> & Vue'
  const wrapper = mount(SearchHighlight, { props: { text, keyword: '<script>' } })
  wrappers.push(wrapper)
  expect(wrapper.text()).toBe(text)
  expect(wrapper.get('mark').text()).toBe('<script>')
  expect(wrapper.find('img').exists()).toBe(false)
  expect(wrapper.find('script').exists()).toBe(false)
})

it('无关键词与未命中不生成高亮标签', async () => {
  const wrapper = mount(SearchHighlight, { props: { text: '中文原文' } })
  wrappers.push(wrapper)
  expect(wrapper.find('mark').exists()).toBe(false)
  await wrapper.setProps({ keyword: '未找到' })
  expect(wrapper.find('mark').exists()).toBe(false)
  expect(wrapper.text()).toBe('中文原文')
})
