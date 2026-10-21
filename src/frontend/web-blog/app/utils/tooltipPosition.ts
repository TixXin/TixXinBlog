/** @file tooltipPosition.ts @description Tooltip 浮层方向自适应探测与视口安全边界位置计算 */
export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right'

export function detectTooltipPlacement(triggerRect: DOMRect, preferred?: TooltipPlacement): TooltipPlacement {
  if (preferred) return preferred

  const { innerWidth: vw, innerHeight: vh } = window
  const spaceTop = triggerRect.top
  const spaceBottom = vh - triggerRect.bottom
  const spaceLeft = triggerRect.left
  const spaceRight = vw - triggerRect.right

  const minRequired = 40

  if (spaceTop >= minRequired) return 'top'
  if (spaceBottom >= minRequired) return 'bottom'
  if (spaceRight >= minRequired) return 'right'
  if (spaceLeft >= minRequired) return 'left'

  const max = Math.max(spaceTop, spaceBottom, spaceLeft, spaceRight)
  if (max === spaceTop) return 'top'
  if (max === spaceBottom) return 'bottom'
  if (max === spaceRight) return 'right'
  return 'left'
}

export function computeTooltipCoordinates(options: {
  triggerRect: DOMRect
  floatingRect: DOMRect
  placement: TooltipPlacement
  offset: number
  vw: number
  vh: number
  margin?: number
}): { top: number; left: number } {
  const { triggerRect, floatingRect, placement, offset, vw, vh, margin = 6 } = options

  let top = 0
  let left = 0

  const cx = triggerRect.left + triggerRect.width / 2
  const cy = triggerRect.top + triggerRect.height / 2

  switch (placement) {
    case 'top':
      top = triggerRect.top - floatingRect.height - offset
      left = cx - floatingRect.width / 2
      break
    case 'bottom':
      top = triggerRect.bottom + offset
      left = cx - floatingRect.width / 2
      break
    case 'left':
      top = cy - floatingRect.height / 2
      left = triggerRect.left - floatingRect.width - offset
      break
    case 'right':
      top = cy - floatingRect.height / 2
      left = triggerRect.right + offset
      break
  }

  left = Math.max(margin, Math.min(left, vw - floatingRect.width - margin))
  top = Math.max(margin, Math.min(top, vh - floatingRect.height - margin))

  return { top, left }
}
