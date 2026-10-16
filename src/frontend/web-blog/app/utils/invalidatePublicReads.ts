/** @file invalidatePublicReads.ts @description 写入入口统一撤销公开缓存与在途响应，保留各领域互动状态的现有所有权 */
import type { NuxtApp } from '#app'
import { invalidateFlashNotes } from '~/features/flash/state'
import { publicReadCache, type PublicReadDomain } from './publicReadCache'

export function invalidatePublicReads(app: NuxtApp, domains?: PublicReadDomain[]) {
  if (!domains) invalidateFlashNotes(app)
  // 沿用实体仓储的同一代次；身份、内容恢复和管理写入也撤销旧的个性化实体读取。
  if (!domains || domains.includes('moment-feed')) {
    app.payload.state['$smoment-collection-generation'] =
      Number(app.payload.state['$smoment-collection-generation'] ?? 0) + 1
    app.payload.state['$smoment-personalized-items'] = Object.create(null)
  }
  if (!domains || domains.includes('guestbook-feed'))
    app.payload.state['$sguestbook-generation'] = Number(app.payload.state['$sguestbook-generation'] ?? 0) + 1
  publicReadCache(app).invalidate(domains)
  if (!domains || domains.includes('post-summary')) app.payload.state['$spost-metadata-retained'] = undefined
  if (!domains || domains.includes('moment-overview')) app.payload.state['$smoment-overview-retained'] = null
  if (!domains || domains.includes('guestbook-metadata')) app.payload.state['$sguestbook-metadata-retained'] = null
}

export function invalidatePublicWrite(app: NuxtApp, path: string) {
  const domain = path.split('/')[2]
  if (['posts', 'taxonomy', 'folders', 'tags'].includes(domain ?? '')) {
    // 朋友圈内嵌文章标题、摘要与公开可见性，也必须随已确认文章写入更新。
    invalidatePublicReads(app, ['posts', 'post-summary', 'archive', 'moment-feed'])
  } else if (domain === 'comments') {
    invalidatePublicReads(app, ['posts', 'post-summary'])
  } else if (['gallery', 'projects', 'links', 'prompts', 'subscriptions'].includes(domain ?? '')) {
    invalidatePublicReads(app, [domain as PublicReadDomain])
  } else if (domain === 'moments' || domain === 'moment-comments') {
    invalidatePublicReads(app, ['moment-feed', 'moment-overview', 'post-summary'])
  } else if (domain === 'guestbook') {
    invalidatePublicReads(app, ['guestbook-feed', 'guestbook-metadata'])
  } else if (domain === 'flashes') {
    invalidateFlashNotes(app)
  } else if (domain === 'media' || domain === 'site') {
    invalidatePublicReads(app)
  }
}
