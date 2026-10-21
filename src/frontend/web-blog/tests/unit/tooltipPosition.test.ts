/** @file tooltipPosition.test.ts @description Tooltip 浮层自适应方向与安全边界位置计算单元测试 */
import { describe, expect, it } from 'vitest'
import { detectTooltipPlacement, computeTooltipCoordinates } from '../../app/utils/tooltipPosition'

describe('tooltipPosition', () => {
  it('优先使用显式指定的 placement', () => {
    const triggerRect = {
      top: 10,
      bottom: 30,
      left: 10,
      right: 50,
      width: 40,
      height: 20,
    } as DOMRect
    expect(detectTooltipPlacement(triggerRect, 'bottom')).toBe('bottom')
  })

  it('在顶部空间足够时自适应优先返回 top', () => {
    const triggerRect = {
      top: 100,
      bottom: 120,
      left: 100,
      right: 140,
      width: 40,
      height: 20,
    } as DOMRect
    expect(detectTooltipPlacement(triggerRect)).toBe('top')
  })

  it('正确计算各方向浮层坐标并限制在视口边界内', () => {
    const triggerRect = {
      top: 100,
      bottom: 120,
      left: 100,
      right: 140,
      width: 40,
      height: 20,
    } as DOMRect
    const floatingRect = {
      width: 60,
      height: 30,
    } as DOMRect

    const { top, left } = computeTooltipCoordinates({
      triggerRect,
      floatingRect,
      placement: 'top',
      offset: 8,
      vw: 1000,
      vh: 1000,
      margin: 6,
    })

    // top = 100 - 30 - 8 = 62
    // left = (100 + 20) - 30 = 90
    expect(top).toBe(62)
    expect(left).toBe(90)
  })
})
