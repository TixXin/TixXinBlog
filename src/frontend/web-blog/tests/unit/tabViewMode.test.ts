/**
 * @file tabViewMode.test.ts
 * @description 标签页视图模式文案与图标映射测试
 */
import { describe, expect, it } from 'vitest'
import { getTabViewModeIcon, getTabViewModeLabel } from '../../app/features/tab/viewMode'

describe('tabViewMode', () => {
  it('为不同视图模式返回对应文案 key', () => {
    const t = (key: string) => `translated:${key}`
    expect(getTabViewModeLabel('grid', t)).toBe('translated:misc.tab.viewMode.grid')
    expect(getTabViewModeLabel('compact', t)).toBe('translated:misc.tab.viewMode.compact')
    expect(getTabViewModeLabel('list', t)).toBe('translated:misc.tab.viewMode.list')
    expect(getTabViewModeLabel('cards', t)).toBe('translated:misc.tab.viewMode.cards')
  })

  it('为不同视图模式返回对应的 Lucide 图标名称', () => {
    expect(getTabViewModeIcon('grid')).toBe('lucide:layout-grid')
    expect(getTabViewModeIcon('compact')).toBe('lucide:grid-2x2')
    expect(getTabViewModeIcon('list')).toBe('lucide:list')
    expect(getTabViewModeIcon('cards')).toBe('lucide:square-stack')
  })
})
