/** @file invalidatePublicReads.ts @description 写入入口统一撤销公开缓存与在途响应，保留各领域互动状态的现有所有权 */
import type { NuxtApp } from '#app'
import { publicReadCache, type PublicReadDomain } from './publicReadCache'

export function invalidatePublicReads(app: NuxtApp, domains?: PublicReadDomain[]) {
  publicReadCache(app).invalidate(domains)
  if (!domains || domains.includes('post-summary')) app.payload.state['$spost-metadata-retained'] = undefined
  if (!domains || domains.includes('moment-overview')) app.payload.state['$smoment-overview-retained'] = null
  if (!domains || domains.includes('guestbook-metadata')) app.payload.state['$sguestbook-metadata-retained'] = null
}

export function invalidatePublicWrite(app: NuxtApp, path: string) {
  const domain = path.split('/')[2]
  if (['posts', 'taxonomy', 'folders', 'tags'].includes(domain ?? '')) {
    invalidatePublicReads(app, ['posts', 'post-summary', 'archive'])
  } else if (domain === 'comments') {
    invalidatePublicReads(app, ['posts', 'post-summary'])
  } else if (['gallery', 'projects', 'links', 'prompts', 'subscriptions'].includes(domain ?? '')) {
    invalidatePublicReads(app, [domain as PublicReadDomain])
  } else if (domain === 'moments' || domain === 'moment-comments') {
    invalidatePublicReads(app, ['moment-overview', 'post-summary'])
  } else if (domain === 'guestbook') {
    invalidatePublicReads(app, ['guestbook-metadata'])
  } else if (domain === 'flashes') {
    app.payload.state['$sflash-notes-loaded'] = false
    app.payload.state['$sflash-notes'] = []
    app.payload.state['$sflash-load-version'] = Number(app.payload.state['$sflash-load-version'] ?? 0) + 1
  } else if (domain === 'media' || domain === 'site') {
    invalidatePublicReads(app)
  }
}
