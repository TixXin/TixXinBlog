/** @file textareaHeadingPosition.ts @description 只改变正文选区和滚动位置，不通过重写文本模拟章节定位。 */
export function focusTextareaHeading(input: HTMLTextAreaElement, offset: number) {
  const position = Math.max(0, Math.min(offset, input.value.length))
  input.focus({ preventScroll: true })
  input.setSelectionRange(position, position)
  input.scrollIntoView?.({ block: 'nearest', behavior: 'instant' })

  // 原生 textarea 没有行坐标接口；只在定位时测量相同排版的前缀，兼容中文折行和长段落。
  const styles = getComputedStyle(input)
  const mirror = document.createElement('div')
  const marker = document.createElement('span')
  Object.assign(mirror.style, {
    position: 'fixed',
    left: '-100000px',
    top: '0',
    visibility: 'hidden',
    width: `${input.clientWidth}px`,
    boxSizing: 'border-box',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'break-word',
  })
  for (const property of [
    'fontFamily',
    'fontSize',
    'fontWeight',
    'fontStyle',
    'fontVariant',
    'lineHeight',
    'letterSpacing',
    'wordSpacing',
    'textIndent',
    'tabSize',
    'wordBreak',
    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'paddingLeft',
  ] as const)
    mirror.style[property] = styles[property]
  mirror.textContent = input.value.slice(0, position)
  marker.textContent = '.'
  mirror.append(marker)
  document.body.append(mirror)
  try {
    const top = marker.getBoundingClientRect().top - mirror.getBoundingClientRect().top
    input.scrollTop = Math.max(0, top - input.clientHeight / 3)
  } finally {
    mirror.remove()
  }
}
