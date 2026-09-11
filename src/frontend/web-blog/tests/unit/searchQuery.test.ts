/** @file searchQuery.test.ts @description 搜索深链页码和类型边界，全部预览不伪装为统一分页。 */
import { expect, it } from 'vitest'
import { searchLocation, searchPage, searchScope } from '../../app/features/search/query'
it('搜索URL保留中文、类型与页码，全部预览移除单类型页码', () => {
  expect(searchLocation('  读书  ', 'gallery', 2)).toEqual({
    path: '/search',
    query: { q: '读书', type: 'gallery', page: '2' },
  })
  expect(searchLocation('读书', 'all', 9)).toEqual({ path: '/search', query: { q: '读书' } })
  expect(searchScope('__proto__')).toBe('all')
  expect(searchScope(['post'])).toBe('all')
  expect(searchPage(-1)).toBe(1)
  expect(searchPage('2.5')).toBe(1)
  expect(searchPage('1000000')).toBe(10000)
})
