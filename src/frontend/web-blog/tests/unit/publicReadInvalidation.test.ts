/** @file publicReadInvalidation.test.ts @description 管理写入按领域失效，公开读取缓存不保留已撤回内容 */
import { describe, expect, it } from 'vitest'
import type { NuxtApp } from '#app'
import { invalidatePublicReads, invalidatePublicWrite } from '../../app/utils/invalidatePublicReads'
import { publicReadCache, type PublicReadDomain } from '../../app/utils/publicReadCache'

function fixture() {
  const app = { payload: { state: {} } } as NuxtApp
  const cache = publicReadCache(app)
  const domains: PublicReadDomain[] = [
    'posts',
    'post-summary',
    'archive',
    'moment-feed',
    'gallery',
    'projects',
    'links',
    'prompts',
    'subscriptions',
  ]
  for (const domain of domains) cache.put(domain, domain, { title: '公开内容' }, 0, 30_000)
  return { app, cache, domains }
}
describe('公开缓存写后失效入口', () => {
  it.each([
    '/admin/posts/1',
    '/admin/posts/1/revisions/2/restore',
    '/admin/posts/batch/execute',
    '/admin/taxonomy/tags/1',
  ])('%s 同时撤销文章列表、轻量统计、归档与朋友圈文章引用', (path) => {
    const { app, cache } = fixture()
    invalidatePublicWrite(app, path)
    for (const key of ['posts', 'post-summary', 'archive', 'moment-feed']) expect(cache.read(key)).toBeUndefined()
    expect(app.payload.state['$smoment-collection-generation']).toBe(1)
    expect(cache.put('moment-feed', 'late-linked-article', { title: '旧文章' }, 0, 30_000)).toBe(false)
    expect(cache.read('gallery')).toBeDefined()
  })
  it.each(['gallery', 'projects', 'links', 'prompts', 'subscriptions'])('%s 写入只撤销对应公开领域', (domain) => {
    const { app, cache } = fixture()
    invalidatePublicWrite(app, `/admin/${domain}/1`)
    expect(cache.read(domain)).toBeUndefined()
    expect(cache.read('archive')).toBeDefined()
  })
  it('评论只更新计数，身份或内容恢复清除全部公开缓存', () => {
    const { app, cache, domains } = fixture()
    invalidatePublicWrite(app, '/admin/comments/1/moderation')
    expect(cache.read('posts')).toBeUndefined()
    expect(cache.read('post-summary')).toBeUndefined()
    expect(cache.read('archive')).toBeDefined()
    invalidatePublicReads(app)
    for (const domain of domains) expect(cache.read(domain)).toBeUndefined()
  })
  it('闪念继续由原有仓储接纳写入结果，不清空包含私有草稿的现有集合', () => {
    const { app } = fixture()
    const notes = [{ id: 'kept', isDraft: true }]
    app.payload.state['$sflash-notes'] = notes
    invalidatePublicWrite(app, '/admin/flashes/new')
    expect(app.payload.state['$sflash-notes']).toBe(notes)
  })
})
