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

/**
 * 匿名访客恢复或登录为博主时只撤销按身份区分的状态。
 * 公开读取不携带访问令牌，刷新 Cookie 只发往 /api/v1/auth，文章、归档、图库、项目、友链等栏目结果不随登录变化；
 * 整体撤销会让水合后已显示的列表清空重建，带登录态的博主每次打开公开页面都会闪空一次。
 * 闪念会切换到包含草稿的管理读取，朋友圈与留言带有按身份区分的互动状态，仍需撤销。
 */
export function invalidateIdentityReads(app: NuxtApp) {
  invalidateFlashNotes(app)
  invalidatePublicReads(app, ['moment-feed', 'guestbook-feed'])
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
