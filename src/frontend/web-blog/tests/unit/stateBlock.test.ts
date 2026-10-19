/**
 * @file stateBlock.test.ts
 * @description 状态提示的操作形态：默认按钮；传入 actionHref 时为可原生跳转的链接，水合后普通点击仍交给 action 事件
 * @author TixXin
 * @since 2026-10-19
 */
import { afterEach, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import StateBlock from '../../app/components/common/StateBlock.vue'

const wrappers: { unmount(): void }[] = []
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))

function mountBlock(props: Record<string, unknown>) {
  const wrapper = mount(StateBlock, {
    props: { icon: 'lucide:search-x', title: '页面未找到', actionLabel: '返回首页', ...props },
    global: { stubs: { Icon: true } },
  })
  wrappers.push(wrapper)
  return wrapper
}

it('未传 actionHref 时操作为按钮，点击触发 action', async () => {
  const wrapper = mountBlock({})
  const action = wrapper.get('.state-block__action')
  expect(action.element.tagName).toBe('BUTTON')
  expect(action.attributes('type')).toBe('button')
  await action.trigger('click')
  expect(wrapper.emitted('action')).toHaveLength(1)
})

it('传入 actionHref 时操作为同名链接，普通点击阻止默认跳转并触发 action', async () => {
  const wrapper = mountBlock({ actionHref: '/' })
  const action = wrapper.get('.state-block__action')
  expect(action.element.tagName).toBe('A')
  expect(action.attributes('href')).toBe('/')
  expect(action.text()).toBe('返回首页')
  expect(wrapper.find('button').exists()).toBe(false)
  const click = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
  action.element.dispatchEvent(click)
  expect(click.defaultPrevented).toBe(true)
  expect(wrapper.emitted('action')).toHaveLength(1)
})

it('带修饰键点击链接保留浏览器默认行为，不触发 action', () => {
  const wrapper = mountBlock({ actionHref: '/' })
  const action = wrapper.get('.state-block__action').element
  for (const init of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { button: 1 }]) {
    const click = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init })
    action.dispatchEvent(click)
    expect(click.defaultPrevented).toBe(false)
  }
  expect(wrapper.emitted('action')).toBeUndefined()
})
