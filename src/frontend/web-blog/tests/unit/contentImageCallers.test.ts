/**
 * @file contentImageCallers.test.ts
 * @description 内容图片调用方保留错误占位，重试不导航、不选择动态，也不覆盖原图地址
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import PostCard from '../../app/components/blog/PostCard.vue'
import RecentPosts from '../../app/components/blog/RecentPosts.vue'
import AboutHero from '../../app/components/about/AboutHero.vue'
import MomentPhotoWallCard from '../../app/components/sidebar/MomentPhotoWallCard.vue'
import type { PostItem } from '../../app/features/post/types'

const source = '/api/v1/media/3b8ada68-c31e-458a-9bde-12cf04e2473e.webp'
const post: PostItem = {
  id: 47,
  title: '山间日出',
  summary: '一次清晨散步',
  cover: source,
  tags: [],
  category: 'life',
  readTime: 3,
  likes: 2,
  views: 8,
  comments: 1,
  date: '2026-10-18',
  folder: '随笔',
}
const global = {
  stubs: {
    CommonTooltip: { template: '<span><slot /></span>' },
    NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
  },
}
const wrappers: { unmount(): void }[] = []

beforeEach(() => {
  // 测试不依赖远程图片解码，由用例显式派发失败事件。
  vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(false)
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.restoreAllMocks()
})

describe('文章卡片的失败恢复', () => {
  it.each(['post', 'recent'] as const)('%s 保留封面区域，重试按钮独立于导航链接', async (kind) => {
    const wrapper =
      kind === 'post'
        ? await mountSuspended(PostCard, { props: { post }, global })
        : await mountSuspended(RecentPosts, { props: { posts: [post] }, global })
    wrappers.push(wrapper)
    const coverSelector = kind === 'post' ? '.post-item__cover-bg' : '.recent-post-item__cover'
    const link = wrapper.get(kind === 'post' ? '.post-item__content' : '.recent-post-item__content')
    expect(link.attributes('href')).toBe('/articles/47')
    const navigate = vi.fn()
    link.element.addEventListener('click', navigate)
    const coverLinkSelector = '.recent-post-item__cover-link'
    const coverClick = vi.fn((event: Event) => event.preventDefault())
    if (kind === 'recent') {
      const coverLink = wrapper.get(coverLinkSelector)
      expect(coverLink.attributes('href')).toBe('/articles/47')
      expect(coverLink.attributes('aria-label')).toBe('阅读文章：山间日出')
      coverLink.element.addEventListener('click', coverClick, { capture: true })
      await coverLink.trigger('click')
      expect(coverClick).toHaveBeenCalledOnce()
      coverClick.mockClear()
    }
    await wrapper.get(`${coverSelector} img`).trigger('error')
    expect(wrapper.find(coverSelector).exists()).toBe(true)
    const retry = wrapper.get('button[aria-label^="图片加载失败，重试："]')
    expect(retry.element.parentElement?.closest('a, button')).toBeNull()
    if (kind === 'post') {
      expect(wrapper.classes()).toContain('post-item--cover-error')
      expect(wrapper.find('.image-failure--compact').exists()).toBe(true)
    } else {
      expect(wrapper.find(coverLinkSelector).exists()).toBe(false)
    }

    await retry.trigger('click', { detail: 0 })
    expect(navigate).not.toHaveBeenCalled()
    expect(coverClick).not.toHaveBeenCalled()
    expect(wrapper.get(`${coverSelector} img`).attributes('src')).toBe(source)
    expect(link.get('h2, h3').text()).toContain(post.title)
    expect(link.attributes('href')).toBe('/articles/47')
    if (kind === 'recent') {
      expect(wrapper.find(coverLinkSelector).exists()).toBe(false)
      const image = wrapper.get(`${coverSelector} img`)
      Object.defineProperties(image.element, {
        complete: { configurable: true, value: true },
        naturalWidth: { configurable: true, value: 900 },
        naturalHeight: { configurable: true, value: 600 },
        decode: { configurable: true, value: vi.fn().mockResolvedValue(undefined) },
      })
      await image.trigger('load')
      await flushPromises()
      expect(wrapper.get(coverLinkSelector).attributes('href')).toBe('/articles/47')
    }
  })
})

describe('头像与照片墙的失败恢复', () => {
  it('关于页头像重试仍使用原图，不换成静态问号图', async () => {
    const wrapper = await mountSuspended(AboutHero, {
      props: { profile: { name: '作者', avatar: source, bio: '生活与记录', socials: [] } },
      global,
    })
    wrappers.push(wrapper)
    await wrapper.get('img').trigger('error')
    const retry = wrapper.get('button[aria-label="图片加载失败，重试：作者"]')
    await retry.trigger('click', { detail: 0 })
    expect(wrapper.get('img').attributes('src')).toBe(source)
  })

  it('照片墙错误时移除眼睛遮罩，重试不会选择动态', async () => {
    const wrapper = await mountSuspended(MomentPhotoWallCard, {
      props: { images: [{ src: source, momentId: 'moment-47' }] },
      global,
    })
    wrappers.push(wrapper)
    expect(wrapper.find('.moment-photo-wall__overlay').exists()).toBe(true)
    await wrapper.get('img').trigger('error')
    expect(wrapper.find('.moment-photo-wall__overlay').exists()).toBe(false)
    const retry = wrapper.get('button[aria-label="图片加载失败，重试：照片 1"]')
    await retry.trigger('click', { detail: 0 })
    expect(wrapper.emitted('select-moment')).toBeUndefined()
    expect(wrapper.get('img').attributes('src')).toBe(source)

    // 失败后动态入口收到角落，仍可单独打开所属动态，且不包含重试按钮。
    const entry = wrapper.get('.moment-photo-wall__open')
    expect(entry.find('button').exists()).toBe(false)
    await entry.trigger('click')
    expect(wrapper.emitted('select-moment')).toEqual([['moment-47']])
  })
})
