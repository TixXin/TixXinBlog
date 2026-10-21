/** @file scrollbarMask.test.ts @description 视口滚动渐变遮罩样式生成单元测试 */
import { describe, expect, it } from 'vitest'
import { computeScrollbarFadeMask } from '../../app/utils/scrollbarMask'

describe('computeScrollbarFadeMask', () => {
  it('未开启 fadeMask 时返回空对象', () => {
    expect(computeScrollbarFadeMask({ fadeMask: false, atTop: false, atBottom: false })).toEqual({})
  })

  it('处于顶部和底部边界时无需遮罩，返回空对象', () => {
    expect(computeScrollbarFadeMask({ fadeMask: 'both', atTop: true, atBottom: true })).toEqual({})
  })

  it('未在顶部时生成顶端淡出遮罩', () => {
    const style = computeScrollbarFadeMask({ fadeMask: 'top', atTop: false, atBottom: true })
    expect(style.maskImage).toContain('transparent 0%')
    expect(style.maskImage).toContain('black 2.5rem')
  })

  it('支持带有 inset 的两端遮罩', () => {
    const style = computeScrollbarFadeMask({ fadeMask: 'both', fadeMaskInset: '10px', atTop: false, atBottom: false })
    expect(style.maskImage).toContain('transparent 10px')
    expect(style.maskImage).toContain('calc(100% - 10px)')
  })
})
