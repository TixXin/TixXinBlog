/**
 * @file aboutPage.test.ts
 * @description 关于页回归：公开过滤与英文回退、简介摘要、三方合并保留新字段、恢复副本校验，
 *              以及简介 Markdown、条目链接、“现在”栏目、rel="me"、联系卡片与支持方式卡片的渲染
 */
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import AboutHero from '../../app/components/about/AboutHero.vue'
import ContactCards from '../../app/components/about/ContactCards.vue'
import DonateCard from '../../app/components/about/DonateCard.vue'
import ProfileContent from '../../app/components/about/ProfileContent.vue'
import AboutItemFields from '../../app/components/admin/AboutItemFields.vue'
import { isAboutSettings, mergeAbout } from '../../app/features/about/editor'
import { externalLinkAttrs } from '../../app/features/about/links'
import { introductionSummary, localizeAbout, publicAbout, publicSupport } from '../../app/features/about/settings'
import type { AboutItem, AboutSettings } from '../../app/features/about/types'

const about = (): AboutSettings => ({
  visible: true,
  introduction: '你好，我是**林间**。这里记录 [Web 技术](https://example.org/web)。',
  en: { introduction: 'Hi, I am **Lin**.' },
  showSiteInfo: true,
  support: {
    visible: true,
    message: '请我喝杯咖啡',
    methods: [
      { label: 'Ko-fi', url: 'https://ko-fi.com/x', image: '' },
      { label: '空', url: '', image: '' },
    ],
  },
  sections: [
    {
      kind: 'now',
      visible: true,
      updatedAt: '2026-11-01',
      items: [
        {
          title: '整理博客',
          detail: '',
          period: '',
          visible: true,
          en: { title: 'Tidying the blog', detail: '', period: '' },
        },
      ],
    },
    {
      kind: 'uses',
      visible: true,
      items: [{ title: 'MacBook Air', detail: '', period: '电脑', visible: true, url: 'https://apple.com/' }],
    },
    { kind: 'reading', visible: false, items: [{ title: '未公开', detail: '', period: '', visible: true }] },
  ],
})

describe('关于页纯逻辑', () => {
  it('公开过滤剔除隐藏栏目与不可用的支持方式；未公开资料时支持方式仍保留', () => {
    const value = publicAbout(about())
    expect(value.sections.map((section) => section.kind)).toEqual(['now', 'uses'])
    expect(value.support?.methods.map((method) => method.label)).toEqual(['Ko-fi'])
    const hidden = publicAbout({ ...about(), visible: false })
    expect(hidden.sections).toEqual([])
    expect(hidden.support?.methods).toHaveLength(1)
    expect(publicSupport({ visible: false, message: '', methods: about().support!.methods })).toBeUndefined()
  })

  it('英文界面逐字段回退到中文，其他语言原样', () => {
    const value = localizeAbout(publicAbout(about()), 'en')
    expect(value.introduction).toBe('Hi, I am **Lin**.')
    expect(value.sections[0]!.items[0]!.title).toBe('Tidying the blog')
    expect(value.sections[1]!.items[0]!.title).toBe('MacBook Air')
    expect(value.support?.message).toBe('请我喝杯咖啡')
    expect(localizeAbout(about(), 'zh-CN')).toEqual(about())
  })

  it('简介摘要去掉 Markdown 记号并截到第一句', () => {
    expect(introductionSummary(about().introduction)).toBe('你好，我是林间。')
    expect(introductionSummary('x'.repeat(200))).toHaveLength(160)
    expect(introductionSummary('')).toBe('')
  })

  it('只有网页主页带 rel="me" 与新标签打开', () => {
    expect(externalLinkAttrs('https://github.com/x')).toEqual({ target: '_blank', rel: 'me noopener' })
    expect(externalLinkAttrs('mailto:a@example.org')).toEqual({})
  })

  it('三方合并保留英文资料、本站信息开关与支持方式，并报告冲突', () => {
    const base = about()
    const local = { ...about(), showSiteInfo: false, en: { introduction: 'Local' } }
    const server = { ...about(), en: { introduction: 'Server' }, support: { ...base.support!, message: '服务器' } }
    const conflicts: string[] = []
    const equal = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right)
    const choose = <T>(before: T, input: T, latest: T, path: string): T => {
      if (equal(input, before)) return latest
      if (!equal(latest, before) && !equal(latest, input)) conflicts.push(path)
      return input
    }
    const merged = mergeAbout({ base, local, server }, { choose, equal, conflicts })
    expect(merged.showSiteInfo).toBe(false)
    expect(merged.support?.message).toBe('服务器')
    expect(merged.en).toEqual({ introduction: 'Local' })
    expect(conflicts).toEqual(['about.en'])
  })

  it('恢复副本接受新字段并拒绝超长或错误类型', () => {
    expect(isAboutSettings(about())).toBe(true)
    expect(isAboutSettings({ ...about(), showSiteInfo: 'yes' as never })).toBe(false)
    expect(isAboutSettings({ ...about(), en: { introduction: 'x'.repeat(5001) } })).toBe(false)
    expect(
      isAboutSettings({
        ...about(),
        support: { ...about().support!, methods: Array(7).fill(about().support!.methods[0]) },
      }),
    ).toBe(false)
  })
})

describe('关于页组件', () => {
  it('简介按 Markdown 渲染并净化，条目链接新窗口打开，“现在”显示更新日期', async () => {
    const value = about()
    value.introduction += '<script>alert(1)</script>'
    const wrapper = await mountSuspended(ProfileContent, { props: { value } })
    const intro = wrapper.find('.profile-content__intro')
    expect(intro.find('strong').text()).toBe('林间')
    expect(intro.html()).not.toContain('<script>')
    expect(wrapper.find('.profile-content__updated time').attributes('datetime')).toBe('2026-11-01')
    const link = wrapper.find('a.about-item-title')
    expect(link.attributes('href')).toBe('https://apple.com/')
    expect(link.attributes('target')).toBe('_blank')
    expect(wrapper.text()).toContain('装备与工具')
    expect(wrapper.text()).not.toContain('未公开')
    wrapper.unmount()
  })

  it('Hero 不渲染空头衔，网页主页声明 rel="me" 并可换行', async () => {
    const wrapper = await mountSuspended(AboutHero, {
      props: {
        profile: {
          name: '林间',
          avatar: '/avatar.svg',
          avatarAlt: '林间的头像',
          bio: '',
          socials: [{ icon: 'lucide:github', label: 'GitHub', href: 'https://github.com/x' }],
        },
      },
    })
    expect(wrapper.find('.about-hero__bio').exists()).toBe(false)
    expect(wrapper.find('nav a').attributes('rel')).toBe('me noopener')
    expect(wrapper.html()).toContain('林间的头像')
    wrapper.unmount()
  })

  it('联系卡片标题为 h2，邮箱不在新标签打开，可显示留言板入口', async () => {
    const wrapper = await mountSuspended(ContactCards, {
      props: {
        contacts: [{ icon: 'lucide:mail', type: '邮箱', value: 'a@example.org', href: 'mailto:a@example.org' }],
        guestbook: true,
      },
    })
    expect(wrapper.find('h2').exists()).toBe(true)
    expect(wrapper.find('a[href^="mailto:"]').attributes('target')).toBeUndefined()
    expect(wrapper.find('a[href="/guestbook"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('支持方式未开启时卡片不渲染，开启后列出可用方式', async () => {
    const { settings } = useSiteSettings()
    const previous = settings.value.about
    try {
      settings.value.about = { visible: true, introduction: '', sections: [] }
      const hidden = await mountSuspended(DonateCard)
      expect(hidden.find('.donate-card').exists()).toBe(false)
      hidden.unmount()
      settings.value.about = about()
      const shown = await mountSuspended(DonateCard)
      expect(shown.find('.donate-card__desc').text()).toBe('请我喝杯咖啡')
      expect(shown.findAll('.donate-card__method')).toHaveLength(1)
      expect(shown.find('.donate-card__link').attributes('href')).toBe('https://ko-fi.com/x')
      shown.unmount()
    } finally {
      settings.value.about = previous
    }
  })

  it('后台条目表单：清空英文与链接时删除字段，书单的补充字段标为作者', async () => {
    const item: AboutItem = { title: '设计心理学', detail: '', period: '', visible: true }
    const wrapper = await mountSuspended(AboutItemFields, {
      props: { modelValue: item, kind: 'reading', 'onUpdate:modelValue': () => {} },
    })
    expect(wrapper.text()).toContain('作者')
    const inputs = wrapper.findAll('input')
    await inputs[2]!.setValue('https://example.org/book')
    expect(item.url).toBe('https://example.org/book')
    await inputs[2]!.setValue('')
    expect('url' in item).toBe(false)
    await inputs[3]!.setValue('The Design of Everyday Things')
    expect(item.en).toEqual({ title: 'The Design of Everyday Things', detail: '', period: '' })
    await inputs[3]!.setValue('')
    expect('en' in item).toBe(false)
    wrapper.unmount()
  })
})
