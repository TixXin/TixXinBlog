/**
 * @file sidebarMomentCards.test.ts
 * @description 朋友圈侧栏卡片的空数据、不可用统计、图片失败与可访问交互回归
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import MomentPhotoWallCard from '../../app/components/sidebar/MomentPhotoWallCard.vue'
import MomentInteractionCard from '../../app/components/sidebar/MomentInteractionCard.vue'
import MomentAuthorCard from '../../app/components/sidebar/MomentAuthorCard.vue'
import MomentTopicCard from '../../app/components/sidebar/MomentTopicCard.vue'
import ContentImage from '../../app/components/common/ContentImage.vue'
import type { OwnerCardInfo } from '../../app/features/site/types'

const wrappers: { unmount(): void }[] = []
const hosts: HTMLElement[] = []
const global = {
  stubs: {
    Icon: { template: '<span aria-hidden="true" />' },
    NuxtImg: { props: ['src', 'alt'], template: '<img :src="src" :alt="alt" />' },
  },
}
const mediaSrc = '/api/v1/media/3b8ada68-c31e-458a-9bde-12cf04e2473e.webp'
const profile: OwnerCardInfo = { name: '林间', title: '记录日常风景', socials: [], quotes: [] }
const stats = {
  totalMoments: 0,
  totalLikes: 0,
  totalComments: 0,
  currentMood: '暂时没有公开动态',
  moodUpdatedAt: '',
}
const topics = [
  { name: '散步', icon: 'lucide:footprints', color: '#0f766e', count: 2, description: '城市里的短途漫游' },
  { name: '摄影', icon: 'lucide:camera', color: '#475569', count: 8, description: '记录街头的光影' },
  { name: '阅读', icon: 'lucide:book-open', color: '#b45309', count: 4, description: '读过的书与感想' },
]

beforeEach(() => {
  // happy-dom 不解码图片，未加载的节点会被当作已完成的失败图；由用例显式派发失败事件。
  vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(false)
})

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  hosts.splice(0).forEach((host) => host.remove())
  vi.restoreAllMocks()
})

function mountHost() {
  const host = document.createElement('div')
  document.body.append(host)
  hosts.push(host)
  return host
}

async function photoWall(images: InstanceType<typeof MomentPhotoWallCard>['$props']['images'] = []) {
  const wrapper = mount(MomentPhotoWallCard, { props: { images }, attachTo: mountHost(), global })
  wrappers.push(wrapper)
  return wrapper
}

async function interaction(users: InstanceType<typeof MomentInteractionCard>['$props']['users'] = [], totalUsers = 0) {
  const wrapper = mount(MomentInteractionCard, { props: { users, totalUsers }, global })
  wrappers.push(wrapper)
  return wrapper
}

async function author(overrides: Partial<InstanceType<typeof MomentAuthorCard>['$props']> = {}) {
  const wrapper = mount(MomentAuthorCard, {
    props: { profile, stats, ...overrides },
    attachTo: mountHost(),
    global,
  })
  wrappers.push(wrapper)
  return wrapper
}

async function topicCard(overrides: Partial<InstanceType<typeof MomentTopicCard>['$props']> = {}) {
  const wrapper = mount(MomentTopicCard, {
    props: { topics, ...overrides },
    attachTo: mountHost(),
    global,
  })
  wrappers.push(wrapper)
  return wrapper
}

describe('朋友圈精选照片墙', () => {
  it('空数据保留零计数，不显示示例图片或可点击空入口', async () => {
    const wrapper = await photoWall()
    expect(wrapper.get('h2').text()).toBe('精选照片')
    expect(wrapper.get('.moment-photo-wall__count').text()).toBe('0')
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.find('.moment-photo-wall__item').exists()).toBe(false)
    expect(wrapper.emitted('select-moment')).toBeUndefined()
  })

  it('只显示前九张，保留总数、首张尺寸和每张照片对应的动态事件', async () => {
    const images = Array.from({ length: 11 }, (_, index) => ({ src: mediaSrc, momentId: `moment-${index + 1}` }))
    const wrapper = await photoWall(images)
    const items = wrapper.findAll('.moment-photo-wall__item')
    const photos = wrapper.findAll('img')
    expect(wrapper.get('.moment-photo-wall__count').text()).toBe('11')
    expect(items).toHaveLength(9)
    expect(items[0]!.classes()).toContain('is-featured')
    expect(items[1]!.classes()).not.toContain('is-featured')
    expect(photos[0]!.attributes()).toMatchObject({ alt: '照片 1', sizes: '180px', loading: 'lazy' })
    expect(photos[8]!.attributes()).toMatchObject({ alt: '照片 9', sizes: '90px', loading: 'lazy' })
    const entries = wrapper.findAll('.moment-photo-wall__open')
    expect(entries).toHaveLength(9)
    await entries[0]!.trigger('click')
    await entries[8]!.trigger('click')
    expect(wrapper.emitted('select-moment')).toEqual([['moment-1'], ['moment-9']])
  })

  it('照片入口使用有名称的原生按钮，可获得键盘焦点且不会提交外围表单', async () => {
    const wrapper = await photoWall([{ src: mediaSrc, momentId: 'moment-focus' }])
    // 入口按钮与图片失败时的重试按钮同级，避免按钮嵌套。
    const entry = wrapper.get<HTMLElement>('.moment-photo-wall__item > .moment-photo-wall__open')
    // 原生按钮由浏览器提供 Enter/空格激活；DOM 单测验证语义和焦点，不伪造键盘默认行为。
    expect(entry.element.tagName).toBe('BUTTON')
    expect(entry.attributes('type')).toBe('button')
    expect(entry.attributes('aria-label')).toBe('查看照片 1 所属动态')
    expect(entry.element.tabIndex).toBe(0)
    entry.element.focus()
    expect(document.activeElement).toBe(entry.element)
  })

  it('图片加载失败后显示带替代文本的重试，重试沿用原地址，动态入口仍然可用', async () => {
    const wrapper = await photoWall([{ src: mediaSrc, momentId: 'moment-error' }])
    const photo = wrapper.get('img')
    await photo.trigger('error')
    // 失败占位替换破图，替代文本进入重试按钮名称；重试不选择动态。
    const retry = wrapper.get('button[aria-label="图片加载失败，重试：照片 1"]')
    await retry.trigger('click')
    expect(wrapper.get('img').attributes('src')).toBe(mediaSrc)
    expect(wrapper.get('img').attributes('alt')).toBe('照片 1')
    expect(wrapper.emitted('select-moment')).toBeUndefined()
    await wrapper.get('img').trigger('error')
    await wrapper.get('.moment-photo-wall__open').trigger('click')
    expect(wrapper.emitted('select-moment')).toEqual([['moment-error']])
    await wrapper.setProps({ images: [] })
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.get('.moment-photo-wall__count').text()).toBe('0')
  })
})

describe('朋友圈互动之星', () => {
  it('没有互动时显示明确空态，不生成样本用户', async () => {
    const wrapper = await interaction()
    expect(wrapper.get('.moment-interaction-card__count').text()).toBe('0 位朋友')
    expect(wrapper.get('.moment-interaction-card__empty').text()).toBe('暂无互动数据')
    expect(wrapper.find('ul').exists()).toBe(false)
    expect(wrapper.find('img').exists()).toBe(false)
  })

  it('按传入排名展示真实评论数，总人数与展示条数独立', async () => {
    const users = ['青禾', '小满', '远山', '阿宁', '知秋'].map((name, index) => ({
      name,
      avatar: mediaSrc,
      commentCount: 12 - index,
    }))
    const wrapper = await interaction(users, 27)
    const rows = wrapper.findAll('li')
    expect(wrapper.get('.moment-interaction-card__count').text()).toBe('27 位朋友')
    expect(rows).toHaveLength(5)
    expect(rows.map((row) => row.get('.moment-interaction-card__name').text())).toEqual(users.map((user) => user.name))
    expect(rows.map((row) => row.get('.moment-interaction-card__rank').text())).toEqual(['1', '2', '3', '4', '5'])
    expect(rows[0]!.get('.moment-interaction-card__rank').classes()).toContain('is-first')
    expect(rows[1]!.get('.moment-interaction-card__rank').classes()).toContain('is-second')
    expect(rows[2]!.get('.moment-interaction-card__rank').classes()).toContain('is-third')
    expect(rows[3]!.get('.moment-interaction-card__rank').classes()).toEqual(['moment-interaction-card__rank'])
    expect(rows[4]!.get('.moment-interaction-card__meta').text()).toBe('8 条评论')
    expect(wrapper.findAll('img').map((image) => image.attributes('alt'))).toEqual(users.map((user) => user.name))
    expect(wrapper.find('.moment-interaction-card__empty').exists()).toBe(false)
  })

  it('头像失败不影响用户名和真实评论数，数据清空后移除旧排行', async () => {
    const wrapper = await interaction([{ name: '青禾', avatar: mediaSrc, commentCount: 0 }], 1)
    await wrapper.get('img').trigger('error')
    expect(wrapper.get('.moment-interaction-card__name').text()).toBe('青禾')
    expect(wrapper.get('.moment-interaction-card__meta').text()).toBe('0 条评论')
    await wrapper.setProps({ users: [], totalUsers: 0 })
    expect(wrapper.find('li').exists()).toBe(false)
    expect(wrapper.get('.moment-interaction-card__empty').text()).toBe('暂无互动数据')
  })
})

describe('朋友圈作者名片', () => {
  it('真实零统计显示为零，缺省头像和可选社交信息使用已有空态', async () => {
    const wrapper = await author()
    expect(wrapper.get('h2').text()).toBe(profile.name)
    expect(wrapper.get('.moment-author-card__bio').text()).toBe(profile.title)
    expect(wrapper.findAll('.moment-author-card__stat-value').map((value) => value.text())).toEqual(['0', '0', '0'])
    expect(wrapper.getComponent(ContentImage).props()).toMatchObject({ src: '/avatar.svg', alt: profile.name })
    expect(wrapper.find('.moment-author-card__mood-time').exists()).toBe(false)
    expect(wrapper.find('.moment-author-card__social').exists()).toBe(false)
  })

  it('加载失败的不可用统计显示占位而非零，恢复后可重新显示真实数据', async () => {
    const wrapper = await author({
      stats: { ...stats, totalMoments: null, totalLikes: null, totalComments: null, currentMood: '统计暂不可用' },
    })
    expect(wrapper.findAll('.moment-author-card__stat-value').map((value) => value.text())).toEqual(['—', '—', '—'])
    expect(wrapper.get('.moment-author-card__mood-text').text()).toBe('统计暂不可用')
    await wrapper.setProps({ stats: { ...stats, totalMoments: 3, totalLikes: 0, totalComments: 8 } })
    expect(wrapper.findAll('.moment-author-card__stat-value').map((value) => value.text())).toEqual(['3', '0', '8'])
  })

  it('保留自定义头像替代文本和心情时间，头像失败不影响作者内容', async () => {
    const wrapper = await author({
      profile: { ...profile, avatar: mediaSrc, avatarAlt: '林间站在湖边' },
      stats: { ...stats, currentMood: '沿湖散步', moodUpdatedAt: '今天', moodIcon: 'lucide:footprints' },
    })
    expect(wrapper.get('img').attributes('alt')).toBe('林间站在湖边')
    await wrapper.get('img').trigger('error')
    expect(wrapper.get('h2').text()).toBe(profile.name)
    expect(wrapper.get('.moment-author-card__mood-text').text()).toBe('沿湖散步')
    expect(wrapper.get('.moment-author-card__mood-time').text()).toBe('今天')
  })

  it('只有图标的社交链接提供可访问名称、键盘焦点与安全外链属性', async () => {
    const wrapper = await author({
      stats: {
        ...stats,
        socialLinks: [{ icon: 'lucide:github', url: 'https://github.com/example', label: 'GitHub' }],
      },
    })
    const link = wrapper.get<HTMLAnchorElement>('a')
    expect(link.attributes()).toMatchObject({
      href: 'https://github.com/example',
      'aria-label': 'GitHub',
      target: '_blank',
      rel: 'noopener noreferrer',
    })
    expect(link.element.tabIndex).toBe(0)
    link.element.focus()
    expect(document.activeElement).toBe(link.element)
  })
})

describe('朋友圈热门话题', () => {
  it('空话题不展示样本或 HOT 标记，全部入口仍可清除筛选', async () => {
    const wrapper = await topicCard({ topics: [] })
    expect(wrapper.find('li').exists()).toBe(false)
    expect(wrapper.find('.moment-topic-card__hot').exists()).toBe(false)
    const all = wrapper.get('button')
    expect(all.text()).toBe('全部')
    expect(all.attributes('aria-pressed')).toBe('true')
    await all.trigger('click')
    expect(wrapper.emitted('select')).toEqual([[null]])
  })

  it('按热度排序并计算比例，保留父组件话题顺序且只标记最热项', async () => {
    const input = topics.map((topic) => ({ ...topic }))
    const wrapper = await topicCard({ topics: input })
    expect(wrapper.findAll('.moment-topic-card__tag-name').map((name) => name.text())).toEqual([
      '#摄影',
      '#阅读',
      '#散步',
    ])
    expect(wrapper.findAll<HTMLElement>('.moment-topic-card__bar').map((bar) => bar.element.style.width)).toEqual([
      '100%',
      '50%',
      '25%',
    ])
    expect(input.map((topic) => topic.name)).toEqual(['散步', '摄影', '阅读'])
    expect(wrapper.findAll('.moment-topic-card__hot')).toHaveLength(1)
    expect(wrapper.get('li').text()).toContain('HOT')
    await wrapper.setProps({ topics: [{ ...topics[0]!, count: 0 }] })
    expect(wrapper.get<HTMLElement>('.moment-topic-card__bar').element.style.width).toBe('0%')
  })

  it('具名原生按钮可聚焦，筛选事件由父组件更新选中状态', async () => {
    const wrapper = await topicCard({ activeTopic: '阅读' })
    const buttons = wrapper.findAll<HTMLButtonElement>('.moment-topic-card__item')
    const photography = buttons[0]!
    expect(photography.text()).toContain('#摄影')
    expect(photography.attributes('type')).toBe('button')
    expect(photography.attributes('aria-pressed')).toBe('false')
    expect(buttons[1]!.attributes('aria-pressed')).toBe('true')
    expect(photography.element.tabIndex).toBe(0)
    photography.element.focus()
    expect(document.activeElement).toBe(photography.element)
    await photography.trigger('click')
    expect(wrapper.emitted('select')).toEqual([['摄影']])
    expect(photography.attributes('aria-pressed')).toBe('false')
    await wrapper.setProps({ activeTopic: '摄影' })
    expect(photography.attributes('aria-pressed')).toBe('true')
    expect(buttons[1]!.attributes('aria-pressed')).toBe('false')
    await wrapper.get('.moment-topic-card__view-all').trigger('click')
    expect(wrapper.emitted('select')).toEqual([['摄影'], [null]])
    await wrapper.setProps({ activeTopic: null })
    expect(wrapper.get('.moment-topic-card__view-all').attributes('aria-pressed')).toBe('true')
    expect(wrapper.findAll('.moment-topic-card__item[aria-pressed="true"]')).toHaveLength(0)
  })
})
