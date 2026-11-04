// @vitest-environment node
/**
 * @file idlePrefetch.test.ts
 * @description 触屏空闲预取：设备与网络判定、主入口目标（排除当前页、隐藏栏目与重复路径）
 * @author TixXin
 * @since 2026-11-05
 */
import { describe, expect, it } from 'vitest'
import { idlePrefetchTargets, shouldIdlePrefetch } from '../../app/features/nav/idlePrefetch'
import { MOBILE_PRIMARY_PATHS } from '../../app/features/nav/routes'

describe('是否空闲预取', () => {
  it('只在不支持悬停的触屏设备上预取', () => {
    expect(shouldIdlePrefetch({ hoverNone: true, effectiveType: '4g' })).toBe(true)
    expect(shouldIdlePrefetch({ hoverNone: false, effectiveType: '4g' })).toBe(false)
  })

  it('省流量模式与 2G 网络不预取，未知网络类型照常预取', () => {
    expect(shouldIdlePrefetch({ hoverNone: true, saveData: true })).toBe(false)
    expect(shouldIdlePrefetch({ hoverNone: true, effectiveType: '2g' })).toBe(false)
    expect(shouldIdlePrefetch({ hoverNone: true, effectiveType: 'slow-2g' })).toBe(false)
    expect(shouldIdlePrefetch({ hoverNone: true, effectiveType: '3g' })).toBe(true)
    expect(shouldIdlePrefetch({ hoverNone: true })).toBe(true)
  })
})

describe('预取目标', () => {
  const allVisible = ['/', '/archive', '/projects', '/flash', '/guestbook', '/about']

  it('取主入口并排除当前页，保持主入口顺序', () => {
    expect(idlePrefetchTargets(MOBILE_PRIMARY_PATHS, allVisible, '/')).toEqual(['/archive', '/flash', '/guestbook'])
    expect(idlePrefetchTargets(MOBILE_PRIMARY_PATHS, allVisible, '/archive/')).toEqual(['/', '/flash', '/guestbook'])
  })

  it('站点导航隐藏的栏目不预取', () => {
    expect(idlePrefetchTargets(MOBILE_PRIMARY_PATHS, ['/', '/archive', '/about'], '/about')).toEqual(['/', '/archive'])
  })

  it('非主入口页面停留时照常预取全部可见主入口，路径规范化后去重', () => {
    expect(idlePrefetchTargets(['/flash/', '/flash', '/'], ['/flash', '/'], '/gallery')).toEqual(['/flash', '/'])
  })
})
