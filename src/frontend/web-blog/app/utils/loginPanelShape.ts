/** @file loginPanelShape.ts @description Nexus 登录卡片轮廓：圆角与头像避让圆通过相切圆弧连接 */
export interface LoginPanelShapeInput {
  width: number
  height: number
  avatarX: number
  avatarY: number
  avatarRadius: number
  gap?: number
  cornerRadius?: number
}

interface Point {
  x: number
  y: number
}

export function createLoginPanelShape({
  width,
  height,
  avatarX,
  avatarY,
  avatarRadius,
  gap = 8,
  cornerRadius = 24,
}: LoginPanelShapeInput) {
  if (
    ![width, height, avatarX, avatarY, avatarRadius, gap, cornerRadius].every(Number.isFinite) ||
    width <= 1 ||
    height <= 1 ||
    avatarRadius <= 0 ||
    gap < 0 ||
    cornerRadius < 0
  )
    return null

  // 描边中心向内缩半个像素，确保完整的 1px 边框位于卡片范围内。
  const left = 0.5,
    top = 0.5,
    right = width - 0.5,
    bottom = height - 0.5
  const corner = Math.min(cornerRadius, (width - 1) / 2, (height - 1) / 2)
  const prefix = `M ${left + corner} ${top} H ${right - corner} A ${corner} ${corner} 0 0 1 ${right} ${top + corner} V ${bottom - corner} A ${corner} ${corner} 0 0 1 ${right - corner} ${bottom}`
  const suffix = `V ${top + corner} A ${corner} ${corner} 0 0 1 ${left + corner} ${top} Z`
  const rounded = `${prefix} H ${left + corner} A ${corner} ${corner} 0 0 1 ${left} ${bottom - corner} ${suffix}`
  const radius = avatarRadius + gap
  const center = { x: avatarX, y: avatarY }
  const leftRadius = 10,
    rightRadius = 10
  const leftY = bottom - leftRadius,
    rightY = bottom - rightRadius
  const leftSquared = (radius + leftRadius) ** 2 - (avatarY - leftY) ** 2
  const rightSquared = (radius + rightRadius) ** 2 - (avatarY - rightY) ** 2

  const plain = { width, height, path: rounded, notch: null }
  // 尚未发生重叠、收起动画中空间不足或测量异常时，用完整圆角外形退化，避免自交路径。
  if (avatarY - radius >= bottom || leftSquared <= 0 || rightSquared <= 0) return plain
  // 两个过渡圆都与同一底边相切，左下角前保留平直段，避免两侧底边高低错位。
  const leftCenter = { x: avatarX - Math.sqrt(leftSquared), y: leftY }
  const rightCenter = { x: avatarX + Math.sqrt(rightSquared), y: rightY }
  const tangent = (fillet: Point, filletRadius: number): Point => ({
    x: avatarX + ((fillet.x - avatarX) * radius) / (radius + filletRadius),
    y: avatarY + ((fillet.y - avatarY) * radius) / (radius + filletRadius),
  })
  const leftTangent = tangent(leftCenter, leftRadius)
  const rightTangent = tangent(rightCenter, rightRadius)
  if (
    avatarX <= leftCenter.x ||
    avatarY <= rightCenter.y ||
    leftCenter.x <= left + corner ||
    avatarY - radius <= top ||
    rightCenter.x >= right - corner ||
    leftTangent.x >= rightTangent.x
  )
    return plain

  const path = `${prefix} H ${rightCenter.x} A ${rightRadius} ${rightRadius} 0 0 1 ${rightTangent.x} ${rightTangent.y} A ${radius} ${radius} 0 0 0 ${leftTangent.x} ${leftTangent.y} A ${leftRadius} ${leftRadius} 0 0 1 ${leftCenter.x} ${bottom} H ${left + corner} A ${corner} ${corner} 0 0 1 ${left} ${bottom - corner} ${suffix}`
  return {
    width,
    height,
    path,
    notch: { center, radius, leftCenter, leftRadius, leftTangent, rightCenter, rightRadius, rightTangent },
  }
}
