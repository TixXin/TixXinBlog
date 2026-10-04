/** @file promptLayout.test.ts @description 提示词瀑布流首行顺序、空结果、自然高度和无重叠布局回归 */
import { describe, expect, it } from 'vitest'
import { promptGridLayout } from '../../app/features/prompt/layout'

describe('图片提示词最短列布局', () => {
  it('首行依照接口顺序从左到右，后续选择当前最短列且顶部单调不退', () => {
    const result = promptGridLayout([300, 120, 220, 170, 80, 160], 640, 3, 20)
    expect(result.columnWidth).toBe(200)
    expect(result.positions).toEqual([
      { left: 0, top: 0 },
      { left: 220, top: 0 },
      { left: 440, top: 0 },
      { left: 220, top: 140 },
      { left: 440, top: 240 },
      { left: 0, top: 320 },
    ])
    expect(result.positions.map((position) => position.top)).toEqual([0, 0, 0, 140, 240, 320])
    expect(result.height).toBe(480)
  })
  it('空集没有虚构占位高度，结果与输入数组顺序一一对应', () => {
    expect(promptGridLayout([], 640, 3, 20)).toEqual({ columnWidth: 200, height: 0, positions: [] })
    const heights = [240, 130, 200]
    const before = [...heights]
    expect(promptGridLayout(heights, 640, 3, 20).positions).toHaveLength(heights.length)
    expect(heights).toEqual(before)
  })
  it.each([1, 2, 3, 4])('%s 列布局保持边界、卡片间距及无重叠', (columns) => {
    const heights = [201, 399, 84, 230, 100, 127, 342, 92, 265, 146, 71, 178]
    const width = 980,
      gap = 16
    const result = promptGridLayout(heights, width, columns, gap)
    result.positions.forEach((position, index) => {
      expect(position.left).toBeGreaterThanOrEqual(0)
      expect(position.left + result.columnWidth).toBeLessThanOrEqual(width)
      expect(position.top + heights[index]!).toBeLessThanOrEqual(result.height)
      if (index) expect(position.top).toBeGreaterThanOrEqual(result.positions[index - 1]!.top)
      for (let previous = 0; previous < index; previous++) {
        const other = result.positions[previous]!
        const separated =
          position.left >= other.left + result.columnWidth + gap ||
          other.left >= position.left + result.columnWidth + gap ||
          position.top >= other.top + heights[previous]! + gap
        expect(separated).toBe(true)
      }
    })
    expect(Math.max(...result.positions.map((position, index) => position.top + heights[index]!))).toBe(result.height)
  })
  it('图片尚未测得高度时首行仍依次占列，同高始终选择左列', () => {
    expect(promptGridLayout([0, 0, 0, 100], 640, 3, 0).positions).toEqual([
      { left: 0, top: 0 },
      { left: 640 / 3, top: 0 },
      { left: (640 / 3) * 2, top: 0 },
      { left: 0, top: 0 },
    ])
    expect(promptGridLayout([100, 100, 100, 100], 640, 3, 20).positions[3]).toEqual({ left: 0, top: 120 })
  })
  it('自然高度或容器列数变化后重新计算，父高度不含额外尾间距', () => {
    const initial = promptGridLayout([100, 100, 100], 420, 2, 20)
    const loaded = promptGridLayout([300, 100, 100], 420, 2, 20)
    expect(initial.positions[2]).toEqual({ left: 0, top: 120 })
    expect(loaded.positions[2]).toEqual({ left: 220, top: 120 })
    expect(loaded.height).toBe(300)
    const narrow = promptGridLayout([300, 100, 100], 260, 1, 12)
    expect(narrow.positions).toEqual([
      { left: 0, top: 0 },
      { left: 0, top: 312 },
      { left: 0, top: 424 },
    ])
    expect(narrow.height).toBe(524)
  })
})
