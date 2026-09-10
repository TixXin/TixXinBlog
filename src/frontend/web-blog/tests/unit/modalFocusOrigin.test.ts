/** @file modalFocusOrigin.test.ts @description 指针入口只修复 WebKit 默认失焦，不覆盖键盘或业务主动移焦 */
import { afterEach, expect, it } from 'vitest'
import { bindModalFocusOrigin, getModalFocusOrigin } from '../../app/utils/modalFocusOrigin'

let dispose: (() => void) | undefined
const nodes: HTMLElement[] = []
afterEach(() => {
  dispose?.()
  nodes.splice(0).forEach((node) => node.remove())
})
function setup() {
  dispose = bindModalFocusOrigin(document)
  const entry = document.createElement('button')
  const other = document.createElement('input')
  document.body.append(entry, other)
  nodes.push(entry, other)
  return { entry, other }
}
function pointer(entry: HTMLElement) {
  entry.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
}

it('再次点击已聚焦入口后浏览器默认退回 body，仍保存真实入口', () => {
  const { entry } = setup()
  entry.focus()
  pointer(entry)
  // 对应 WebKit pointerdown 默认动作的 focusout；不是应用显式选择另一个焦点目标。
  entry.blur()
  expect(document.activeElement).toBe(document.body)
  expect(getModalFocusOrigin(document)).toBe(entry)
})
it('指针后业务主动聚焦其他元素，尊重实际焦点目标', () => {
  const { entry, other } = setup()
  entry.focus()
  pointer(entry)
  other.focus()
  expect(getModalFocusOrigin(document)).toBe(other)
})
it('键盘动作清除此前指针来源，不沿用旧入口', () => {
  const { entry } = setup()
  entry.focus()
  pointer(entry)
  entry.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
  entry.blur()
  expect(getModalFocusOrigin(document)).toBe(document.body)
})
it('不同按钮失焦到 body 时不误认点击目标曾经聚焦', () => {
  const { entry, other } = setup()
  other.focus()
  pointer(entry)
  other.blur()
  expect(getModalFocusOrigin(document)).toBe(document.body)
})
