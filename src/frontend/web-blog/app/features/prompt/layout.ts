/** @file layout.ts @description 按输入顺序放入最短列，保留首行从左到右及后续卡片顶部的阅读顺序 */
export function promptGridLayout(heights: readonly number[], width: number, columns: number, gap: number) {
  const count = Number.isFinite(columns) ? Math.max(1, Math.min(4, Math.floor(columns))) : 1
  const spacing = Number.isFinite(gap) ? Math.max(0, gap) : 0
  const columnWidth = Math.max(0, ((Number.isFinite(width) ? width : 0) - spacing * (count - 1)) / count)
  const bottoms = Array<number>(count).fill(0)
  const positions = heights.map((height, index) => {
    // 首行即使尚未测得高度也按原顺序占列；之后同高时仍优先左列。
    let column = index < count ? index : 0
    if (index >= count)
      for (let candidate = 1; candidate < count; candidate++)
        if (bottoms[candidate]! < bottoms[column]!) column = candidate
    const top = bottoms[column]!
    const safeHeight = Number.isFinite(height) ? Math.max(0, height) : 0
    bottoms[column] = top + safeHeight + spacing
    return { left: column * (columnWidth + spacing), top }
  })
  return { columnWidth, height: heights.length ? Math.max(...bottoms) - spacing : 0, positions }
}
