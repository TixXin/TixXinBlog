/**
 * @file i18nFormat.test.ts
 * @description 跟随界面语言的格式化、接口错误文案、发布时间文案与语言切换组件
 * @author TixXin
 * @since 2026-10-19
 */

import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LocaleSwitch from '../../app/components/layout/LocaleSwitch.vue'
import { formatCalendarDate, formatRelativeDate } from '../../app/composables/useRelativeDate'
import { apiErrorMessage, apiResponseMessage } from '../../app/utils/apiError'
import { currentLocale, formatDate, formatDateTime, formatNumber, formatRelative } from '../../app/utils/format'

/** 用到时再取：收集阶段 Nuxt 测试应用尚未就绪 */
const i18n = () => useNuxtApp().$i18n

/** 在指定语言下执行断言，结束后切回中文，避免影响同一 worker 的其他用例 */
async function inLocale(locale: 'zh-CN' | 'en', run: () => void | Promise<void>) {
  await i18n().setLocale(locale)
  try {
    await run()
  } finally {
    await i18n().setLocale('zh-CN')
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('format', () => {
  it('默认跟随中文并与原 toLocaleString(zh-CN) 输出一致', () => {
    const instant = new Date('2026-04-03T08:05:09Z')
    expect(currentLocale()).toBe('zh-CN')
    expect(formatDateTime(instant, { hour12: false })).toBe(instant.toLocaleString('zh-CN', { hour12: false }))
    expect(formatDateTime(instant.toISOString())).toBe(instant.toLocaleString('zh-CN'))
    expect(formatDate(instant.getTime())).toBe(instant.toLocaleDateString('zh-CN'))
    expect(formatNumber(1234567)).toBe((1234567).toLocaleString('zh-CN'))
  })

  it('切换英文后按英文格式输出', async () => {
    const instant = new Date('2026-04-03T08:05:09Z')
    await inLocale('en', () => {
      expect(currentLocale()).toBe('en')
      expect(formatDateTime(instant, { hour12: false })).toBe(instant.toLocaleString('en', { hour12: false }))
      expect(formatDate(instant, { month: 'long' })).toBe('April')
      expect(formatNumber(1234567.5)).toBe('1,234,567.5')
    })
  })

  it('空值与非法输入返回空串，不泄露 Invalid Date 或 NaN', () => {
    expect(formatDateTime(null)).toBe('')
    expect(formatDate('not-a-date')).toBe('')
    expect(formatNumber(Number.NaN)).toBe('')
    expect(formatNumber(undefined)).toBe('')
    expect(formatRelative('')).toBe('')
  })

  it('相对时间取最大单位并跟随语言', async () => {
    const now = new Date('2026-04-03T10:00:00Z')
    expect(formatRelative(new Date('2026-04-03T09:57:00Z'), { now })).toBe('3分钟前')
    expect(formatRelative(new Date('2026-04-02T10:00:00Z'), { now })).toBe('昨天')
    await inLocale('en', () => {
      expect(formatRelative(new Date('2026-04-03T09:57:00Z'), { now })).toBe('3 minutes ago')
      expect(formatRelative(new Date('2026-04-04T10:00:00Z'), { now })).toBe('tomorrow')
      expect(formatRelative(new Date('2026-03-20T10:00:00Z'), { now })).toBe('2 weeks ago')
    })
  })
})

describe('发布时间文案', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-03T10:00:00'))
  })

  it('英文界面使用 common 字典的英文文案', async () => {
    await inLocale('en', () => {
      expect(formatRelativeDate('2026-04-03')).toBe('Published today')
      expect(formatRelativeDate('2026-04-02')).toBe('Published yesterday')
      expect(formatRelativeDate('2026-03-31')).toBe('Published 3 days ago')
      expect(formatRelativeDate('2026-03-01')).toBe('Published on 2026-03-01')
      expect(formatRelativeDate('bad')).toBe('Publish date unknown')
      expect(formatCalendarDate('')).toBe('Date unknown')
    })
    expect(formatRelativeDate('2026-03-31')).toBe('发布于3天前')
  })

  it('非组件调用方可显式传入翻译函数', () => {
    const t = (key: string, params?: Record<string, unknown>) => `${key}:${JSON.stringify(params ?? {})}`
    expect(formatRelativeDate('2026-03-31', t)).toBe('common.date.publishedDaysAgo:{"days":3}')
  })
})

describe('apiErrorMessage', () => {
  it('优先显示后端返回的 message，数组取首条', () => {
    expect(apiErrorMessage({ data: { code: 409, message: '标题已存在' } }, 'common.error.requestFailed')).toBe(
      '标题已存在',
    )
    expect(apiResponseMessage({ data: { message: ['字段不能为空', '其他'] } })).toBe('字段不能为空')
  })

  it('没有可读 message 时显示当前语言的兜底文案，不展示技术性 Error.message', async () => {
    const technical = Object.assign(new Error('[GET] "/api/v1/posts": 500 Internal Server Error'), { data: {} })
    expect(apiErrorMessage(technical, 'common.error.requestFailed')).toBe('操作未完成，请稍后重试')
    expect(apiErrorMessage(null, 'common.error.requestFailed')).toBe('操作未完成，请稍后重试')
    expect(apiErrorMessage({ data: { message: '  ' } }, 'common.error.requestFailed')).toBe('操作未完成，请稍后重试')
    await inLocale('en', () => {
      expect(apiErrorMessage(technical, 'common.error.requestFailed')).toBe(
        'Something went wrong. Please try again later.',
      )
    })
  })

  it('兜底文案支持插值与显式翻译函数', () => {
    expect(apiErrorMessage(undefined, 'common.feed.rss', { params: { site: '山间手记' } })).toBe('山间手记 RSS')
    expect(apiErrorMessage(undefined, 'x.y', { t: (key) => `T(${key})` })).toBe('T(x.y)')
  })
})

describe('LocaleSwitch', () => {
  afterEach(async () => {
    await i18n().setLocale('zh-CN')
    useCookie('blog-locale').value = null
  })

  it('以各自语言列出选项，切换后就地更新文案并记住选择', async () => {
    const wrapper = await mountSuspended(LocaleSwitch)
    const group = wrapper.get('[role="group"]')
    expect(group.attributes('aria-label')).toBe('选择界面语言')
    const buttons = wrapper.findAll('button')
    expect(buttons.map((button) => [button.text(), button.attributes('lang')])).toEqual([
      ['简体中文', 'zh-CN'],
      ['English', 'en'],
    ])
    expect(buttons[0]!.attributes('aria-pressed')).toBe('true')
    expect(buttons[1]!.attributes('aria-pressed')).toBe('false')

    await buttons[1]!.trigger('click')
    await vi.waitFor(() => expect(i18n().locale.value).toBe('en'))
    await wrapper.vm.$nextTick()
    expect(useCookie('blog-locale').value).toBe('en')
    expect(wrapper.get('[role="group"]').attributes('aria-label')).toBe('Choose interface language')
    expect(wrapper.findAll('button')[1]!.attributes('aria-pressed')).toBe('true')
  })
})
