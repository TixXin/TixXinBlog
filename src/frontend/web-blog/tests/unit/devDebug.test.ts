/**
 * @file devDebug.test.ts
 * @description Dev 调试面板纯逻辑与状态计算单测
 * @author TixXin
 * @since 2026-10-21
 */

import { describe, it, expect } from 'vitest'
import { resolveBreakpoint, VIEWPORT_PRESETS } from '~/features/dev/viewport'
import {
  PREVIEW_KEYS,
  PREVIEW_GROUPS,
  formatActivePreview,
  isPreviewActive,
  createPreviewNavigation,
  createExitPreviewNavigation,
} from '~/features/dev/preview'
import { DEBUG_TABS, DOCK_OPTIONS, COLOR_MODE_OPTIONS } from '~/features/dev/constants'

describe('devDebug / viewport', () => {
  it('正确解析各区间断点及提示', () => {
    expect(resolveBreakpoint(1920)).toEqual({ breakpoint: 'xl', hint: '≥1280' })
    expect(resolveBreakpoint(1280)).toEqual({ breakpoint: 'xl', hint: '≥1280' })
    expect(resolveBreakpoint(1279)).toEqual({ breakpoint: 'lg', hint: '1024–1279' })
    expect(resolveBreakpoint(1024)).toEqual({ breakpoint: 'lg', hint: '1024–1279' })
    expect(resolveBreakpoint(1023)).toEqual({ breakpoint: 'md', hint: '768–1023' })
    expect(resolveBreakpoint(768)).toEqual({ breakpoint: 'md', hint: '768–1023' })
    expect(resolveBreakpoint(767)).toEqual({ breakpoint: 'sm', hint: '640–767' })
    expect(resolveBreakpoint(640)).toEqual({ breakpoint: 'sm', hint: '640–767' })
    expect(resolveBreakpoint(639)).toEqual({ breakpoint: 'xs', hint: '480–639' })
    expect(resolveBreakpoint(480)).toEqual({ breakpoint: 'xs', hint: '480–639' })
    expect(resolveBreakpoint(479)).toEqual({ breakpoint: '<xs', hint: '<480' })
    expect(resolveBreakpoint(320)).toEqual({ breakpoint: '<xs', hint: '<480' })
  })

  it('视口预设包含完整且合法尺寸', () => {
    expect(VIEWPORT_PRESETS.length).toBeGreaterThan(0)
    for (const preset of VIEWPORT_PRESETS) {
      expect(preset.w).toBeGreaterThan(0)
      expect(preset.h).toBeGreaterThan(0)
      expect(preset.label).toBeTruthy()
      expect(preset.icon).toContain('lucide:')
    }
  })
})

describe('devDebug / preview', () => {
  it('格式化当前激活的预览标记文本', () => {
    expect(formatActivePreview({})).toBe('')
    expect(formatActivePreview({ preview: 'form' })).toBe('form')
    expect(formatActivePreview({ preview: 'form', 'preview-submit': 'fail' })).toBe('form · fail')
    expect(formatActivePreview({ preview: '', 'preview-submit': '' })).toBe('')
  })

  it('精准判断预览项激活状态', () => {
    const item = {
      label: '表单',
      icon: 'lucide:file-pen',
      path: '/setup',
      query: { preview: 'form' },
    }

    expect(isPreviewActive('/setup', { preview: 'form' }, item)).toBe(true)
    expect(isPreviewActive('/setup', { preview: 'closed' }, item)).toBe(false)
    expect(isPreviewActive('/admin/login', { preview: 'form' }, item)).toBe(false)
    expect(isPreviewActive('/setup', { preview: 'form', 'preview-submit': 'fail' }, item)).toBe(false)
  })

  it('构建激活预览时的路由目标，保留已有无关 query', () => {
    const item = {
      label: '表单',
      icon: 'lucide:file-pen',
      path: '/setup',
      query: { preview: 'form' },
    }

    // 相同 path 时保留已有其他 query
    const targetSamePath = createPreviewNavigation('/setup', { preview: 'closed', foo: 'bar' }, item)
    expect(targetSamePath).toEqual({
      path: '/setup',
      query: { foo: 'bar', preview: 'form' },
    })

    // 不同 path 时不带原有路径的私有 query
    const targetDiffPath = createPreviewNavigation('/admin/login', { preview: 'setup-pending', foo: 'bar' }, item)
    expect(targetDiffPath).toEqual({
      path: '/setup',
      query: { preview: 'form' },
    })
  })

  it('构建退出预览时的路由目标，清理 preview 相关 query 并保留其他 query 与 hash', () => {
    const exitTarget = createExitPreviewNavigation(
      '/setup',
      { preview: 'form', 'preview-submit': 'fail', lang: 'zh', page: '1' },
      '#section',
    )
    expect(exitTarget).toEqual({
      path: '/setup',
      query: { lang: 'zh', page: '1' },
      hash: '#section',
    })
  })

  it('预览常量定义有效', () => {
    expect(PREVIEW_KEYS).toContain('preview')
    expect(PREVIEW_KEYS).toContain('preview-submit')
    expect(PREVIEW_GROUPS.length).toBeGreaterThan(0)
  })
})

describe('devDebug / constants', () => {
  it('定义完备的 tabs、停靠与主题选项', () => {
    expect(DEBUG_TABS.map((t) => t.id)).toEqual(['viewport', 'route', 'auth', 'preview', 'env'])
    expect(DOCK_OPTIONS.map((d) => d.value)).toEqual(['left', 'right', 'top', 'bottom', 'center'])
    expect(COLOR_MODE_OPTIONS.map((c) => c.value)).toEqual(['light', 'dark', 'system'])
  })
})
