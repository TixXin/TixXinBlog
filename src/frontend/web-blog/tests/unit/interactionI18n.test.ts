/**
 * @file interactionI18n.test.ts
 * @description 互动域（留言板、友链、登录面板）英文冒烟：切到 en 后关键文案与格式化跟随界面语言，切回中文保持原文
 * @author TixXin
 * @since 2026-10-19
 */
import { afterEach, describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import GuestbookEmptyState from '../../app/components/guestbook/EmptyState.vue'
import GuestbookMessageBubble from '../../app/components/guestbook/MessageBubble.vue'
import GuestbookOverview from '../../app/components/guestbook/Overview.vue'
import LinkStats from '../../app/components/link/LinkStats.vue'
import LinkForm from '../../app/components/link/LinkForm.vue'
import AuthLoginForm from '../../app/components/auth/AuthLoginForm.vue'
import AuthPanel from '../../app/components/auth/AuthPanel.vue'
import { guestbookDisplay } from '../../app/features/guestbook/display'
import { linkSiteInfo, siteInfoText } from '../../app/features/link/siteInfo'
import { defaultSiteSettings } from '../../app/features/site/settings'
import type { GuestbookRecord } from '../../app/features/guestbook/types'

// 在用例内取，收集阶段测试应用尚未就绪
const i18n = () => useNuxtApp().$i18n

const record: GuestbookRecord = {
  id: 7,
  author: 'Mia',
  avatar: '',
  content: '你好',
  createdAt: '2026-09-09T10:05:00.000Z',
  isOwner: true,
  isPinned: false,
  moderationStatus: 'pending',
  replyTo: null,
  replyUnavailable: true,
  reactions: [{ emoji: '👍', count: 2, reacted: false }],
}

afterEach(async () => {
  await i18n().setLocale('zh-CN')
})

describe('互动域英文界面', () => {
  it('留言空状态、气泡状态与回应名称切到英文', async () => {
    await i18n().setLocale('en')
    const empty = await mountSuspended(GuestbookEmptyState, { props: { filter: 'keyword “Vue”' } })
    expect(empty.text()).toContain('No matching messages')
    expect(empty.text()).toContain('Nothing matches keyword “Vue”')
    expect(empty.text()).toContain('Clear filters')

    const bubble = await mountSuspended(GuestbookMessageBubble, {
      props: { message: guestbookDisplay(record), interactive: true },
    })
    expect(bubble.text()).toContain('Author')
    expect(bubble.text()).toContain('The quoted message is not visible')
    expect(bubble.text()).toContain('Awaiting review, visible only to you')
    expect(bubble.find('.message-bubble__reaction').attributes('aria-label')).toBe('Like, 2 reactions')
    expect(bubble.find('.message-bubble__content').attributes('aria-label')).toBe('Mia (author), 09/09, 10:05')
    expect(bubble.find('.message-bubble__avatar').attributes('alt')).toBe('Avatar of Mia')
  })

  it('留言统计用英文标签与数字分组', async () => {
    await i18n().setLocale('en')
    const overview = await mountSuspended(GuestbookOverview, {
      props: {
        data: { stats: { messages: 12345, members: 3, recent: 9, today: 1 }, pinned: null, members: [], rules: [] },
        pending: false,
      },
    })
    expect(overview.text()).toContain('Public messages')
    expect(overview.text()).toContain('Today · UTC')
    expect(overview.text()).toContain('House rules')
  })

  it('友链概览、整理表单与本站资料切到英文', async () => {
    await i18n().setLocale('en')
    const stats = await mountSuspended(LinkStats, { props: { stats: { links: 4, featured: 1, domains: 3 } } })
    expect(stats.text()).toContain('Link overview')
    expect(stats.text()).toContain('Unique domains')
    const form = await mountSuspended(LinkForm, {
      props: {
        value: { name: '', url: '', avatar: '', description: '' },
        ready: true,
        valid: false,
        copying: false,
        error: '',
        notice: '',
        storageError: '',
      },
    })
    expect(form.text()).toContain('Prepare your link details')
    expect(form.text()).toContain('Copy link details')
    const info = linkSiteInfo(
      { ...defaultSiteSettings, name: '站点', description: '介绍' },
      true,
      'https://site.example',
    )!
    expect(siteInfoText(info)).toContain('Name: 站点')
    expect(siteInfoText(info)).toContain('URL: https://site.example/')
  })

  it('登录面板与登录表单切到英文', async () => {
    await i18n().setLocale('en')
    const panel = await mountSuspended(AuthPanel)
    expect(panel.find('.auth-panel__title').text()).toBe('Sign in')
    const login = await mountSuspended(AuthLoginForm)
    expect(login.text()).toContain('Username')
    expect(login.text()).toContain('Password')
    expect(login.find('button[type="submit"]').text()).toBe('Sign in')
  })

  it('默认中文保持原文', async () => {
    const bubble = await mountSuspended(GuestbookMessageBubble, { props: { message: guestbookDisplay(record) } })
    expect(bubble.find('.message-bubble__reaction').attributes('aria-label')).toBe('赞，2 次回应')
    expect(bubble.find('.message-bubble__content').attributes('aria-label')).toBe('Mia（博主），09/09 10:05')
    const info = linkSiteInfo(
      { ...defaultSiteSettings, name: '站点', description: '介绍' },
      true,
      'https://site.example',
    )!
    expect(siteInfoText(info)).toContain('名称：站点')
  })
})
