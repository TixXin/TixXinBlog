// @vitest-environment node
/** @file loginPanelShape.test.ts @description 凹口间隙、圆弧相切、动态高度和退化边界验证 */
import { describe, expect, it } from 'vitest'
import { createLoginPanelShape } from '../../app/utils/loginPanelShape'

const sample = { width: 1374, height: 397, avatarX: 84, avatarY: 419, avatarRadius: 40 }
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y)

describe('登录卡片头像避让轮廓', () => {
  it.each([160, 397, 540.25])('高度 %s 下保持 8px 间隙、两端相切和底边对齐', (height) => {
    const shape = createLoginPanelShape({ ...sample, height, avatarY: height + 22 })!
    expect(shape.notch).not.toBeNull()
    const notch = shape.notch!
    expect(notch.radius - sample.avatarRadius).toBe(8)
    expect(notch.radius - sample.avatarRadius * 1.05).toBe(6)
    for (const [center, radius, tangent] of [
      [notch.leftCenter, notch.leftRadius, notch.leftTangent],
      [notch.rightCenter, notch.rightRadius, notch.rightTangent],
    ] as const) {
      expect(distance(notch.center, center)).toBeCloseTo(notch.radius + radius, 9)
      expect(distance(notch.center, tangent)).toBeCloseTo(notch.radius, 9)
      expect(distance(center, tangent)).toBeCloseTo(radius, 9)
      // 切点处两个半径反向共线，因此相邻轮廓的切线连续。
      const a = { x: tangent.x - notch.center.x, y: tangent.y - notch.center.y }
      const b = { x: tangent.x - center.x, y: tangent.y - center.y }
      expect(a.x * b.y - a.y * b.x).toBeCloseTo(0, 9)
      expect(a.x * b.x + a.y * b.y).toBeLessThan(0)
    }
    expect(notch.leftCenter.y + notch.leftRadius).toBe(height - 0.5)
    expect(notch.leftCenter.x).toBeGreaterThan(24.5)
    expect(notch.leftTangent.y).toBe(notch.rightTangent.y)
    expect(notch.rightCenter.y + notch.rightRadius).toBe(height - 0.5)
    expect(notch.leftTangent.x).toBeLessThan(notch.center.x)
    expect(notch.rightTangent.x).toBeGreaterThan(notch.center.x)
    expect(shape.path).not.toMatch(/NaN|Infinity/)
  })

  it('改变卡片宽高不拉伸凹弧，保持相对底边位置', () => {
    const first = createLoginPanelShape(sample)!.notch!
    const second = createLoginPanelShape({ ...sample, width: 982, height: 197, avatarY: 219 })!.notch!
    expect(second.radius).toBe(first.radius)
    expect(second.leftTangent.x).toBe(first.leftTangent.x)
    expect(second.rightTangent.x).toBe(first.rightTangent.x)
    expect(second.leftTangent.y - 197).toBeCloseTo(first.leftTangent.y - 397, 9)
  })

  it.each([{ width: 90 }, { height: 25 }, { avatarX: 35 }, { avatarY: 500 }, { avatarY: 80 }])(
    '空间不足或头像不与底边相交时不产生自交凹口：%j',
    (overrides) => {
      const shape = createLoginPanelShape({ ...sample, ...overrides })!
      expect(shape.notch).toBeNull()
      expect(shape.path).not.toMatch(/NaN|Infinity/)
      expect(shape.path.endsWith('Z')).toBe(true)
    },
  )

  it.each([{ width: 0 }, { height: NaN }, { avatarRadius: -1 }, { gap: -1 }])('拒绝无效测量：%j', (overrides) => {
    expect(createLoginPanelShape({ ...sample, ...overrides })).toBeNull()
  })
})
