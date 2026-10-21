/** @file scrollbarMask.ts @description 视口滚动渐变遮罩样式生成 */
export function computeScrollbarFadeMask(options: {
  fadeMask: 'top' | 'bottom' | 'both' | false
  fadeMaskInset?: string
  atTop: boolean
  atBottom: boolean
}): Record<string, string> {
  const { fadeMask, fadeMaskInset = '0', atTop, atBottom } = options
  if (!fadeMask) return {}
  const topActive = (fadeMask === 'top' || fadeMask === 'both') && !atTop
  const botActive = (fadeMask === 'bottom' || fadeMask === 'both') && !atBottom
  if (!topActive && !botActive) return {}

  const inset = fadeMaskInset
  const hasInset = inset && inset !== '0'
  const stops: string[] = []
  if (topActive) {
    stops.push('transparent 0%')
    if (hasInset) stops.push(`transparent ${inset}`)
    stops.push(hasInset ? `black calc(${inset} + 2.5rem)` : 'black 2.5rem')
  } else {
    stops.push('black 0%')
  }
  if (botActive) {
    stops.push(hasInset ? `black calc(100% - ${inset} - 2.5rem)` : 'black calc(100% - 2.5rem)')
    if (hasInset) stops.push(`transparent calc(100% - ${inset})`)
    stops.push('transparent 100%')
  } else {
    stops.push('black 100%')
  }
  const gradient = `linear-gradient(to bottom, ${stops.join(', ')})`
  return { maskImage: gradient, WebkitMaskImage: gradient }
}
