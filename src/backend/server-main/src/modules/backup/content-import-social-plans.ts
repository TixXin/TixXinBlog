/**
 * @file content-import-social-plans.ts
 * @description 迁入计划中文章、闪念与朋友圈的去重判定、编号映射与计划生成。
 */
import type { EntityManager } from '@mikro-orm/postgresql'
import type { ContentImportPlan } from '../../entities/content-import.entity'
import type { ContentPackage, PackageFlash, PackageMoment, PackagePost } from './content-package'
import { zh } from '../../common/i18n'
import { flashContentHash, momentContentHash } from './content-import-hashes'
import { normalizedPost } from './content-import-plan'

export async function buildPostPlans(
  em: EntityManager,
  posts: PackagePost[],
  incomingHash: (type: 'post', id: number, values?: unknown) => string,
  existingPosts: Set<string>,
  occupiedSlugs: Set<string>,
  strategy: 'skip' | 'copy',
  ticket: string,
  errors: string[],
  requiredValues: unknown[],
  sourcePostHashes: Map<number, string>,
): Promise<{ postPlans: ContentImportPlan['posts']; comments: number }> {
  const postPlans: ContentImportPlan['posts'] = []
  let comments = 0
  for (const source of posts) {
    let values = source.values
    try {
      values = await normalizedPost(em, source.values)
    } catch {
      errors.push(zh('backup.planPostFolderUnmapped', { sourceId: source.sourceId }))
    }
    const hash = incomingHash('post', source.sourceId, values)
    sourcePostHashes.set(source.sourceId, hash)
    const duplicate = existingPosts.has(hash)
    const skip = strategy === 'skip' && duplicate
    let slug = source.values.slug ?? ''
    let reason = zh(
      skip ? 'backup.planSkipSameWithComments' : duplicate ? 'backup.planPostCopy' : 'backup.planPostCreate',
    )
    if (!skip && slug && occupiedSlugs.has(slug)) {
      slug = `${slug.slice(0, 90).replace(/-+$/, '')}-import-${ticket.slice(0, 8)}-${source.sourceId}`
      // 组合原因整句登记，持久化中文与迁移前逐字一致，读取时也能整句反查翻译。
      reason = zh(duplicate ? 'backup.planPostCopyNewSlug' : 'backup.planPostCreateNewSlug')
    }
    if (!skip) {
      if (slug && occupiedSlugs.has(slug)) errors.push(zh('backup.planPostSlugConflict', { sourceId: source.sourceId }))
      if (slug) occupiedSlugs.add(slug)
      existingPosts.add(hash)
      comments += source.comments.length
      requiredValues.push(
        values.cover,
        values.contentRaw,
        source.comments.map((comment) => comment.avatar),
      )
    }
    postPlans.push({ sourceId: source.sourceId, title: source.values.title, skip, slug, reason })
  }
  return { postPlans, comments }
}

export function buildFlashPlans(
  flashes: PackageFlash[],
  strategy: 'skip' | 'copy',
  existingFlashes: Set<string>,
  requiredValues: unknown[],
): { flashPlans: ContentImportPlan['flashes']; comments: number } {
  let comments = 0
  const flashPlans = flashes.map((source) => {
    const hash = flashContentHash(source.values)
    const skip = strategy === 'skip' && existingFlashes.has(hash)
    if (!skip) {
      existingFlashes.add(hash)
      comments += source.comments.length
      requiredValues.push(
        source.values.content,
        source.values.images,
        source.comments.map((comment) => comment.avatar),
      )
    }
    return {
      sourceId: source.sourceId,
      title: source.values.content?.slice(0, 100) ?? '',
      skip,
      reason: zh(skip ? 'backup.planSkipSameWithComments' : 'backup.planFlashCreate'),
    }
  })
  return { flashPlans, comments }
}

export function buildMomentPlans(
  moments: PackageMoment[],
  strategy: 'skip' | 'copy',
  existingMoments: Set<string>,
  sourcePostHashes: Map<number, string>,
  currentPostHashes: Map<number, string>,
  currentPosts: ContentPackage['posts'],
  postPlans: ContentImportPlan['posts'],
  requiredValues: unknown[],
  errors: string[],
): { momentPlans: ContentImportPlan['moments']; comments: number } {
  let comments = 0
  const momentPlans = moments.map((source) => {
    const articleHash = source.values.linkedArticleId
      ? (sourcePostHashes.get(source.values.linkedArticleId) ?? null)
      : null
    const hash = momentContentHash(source.values, articleHash)
    const skip = strategy === 'skip' && existingMoments.has(hash)
    const linkedArticleId = articleHash
      ? (currentPosts.find((post) => !post.deleted && currentPostHashes.get(post.sourceId) === articleHash)?.sourceId ??
        null)
      : null
    if (!skip) {
      existingMoments.add(hash)
      comments += source.comments.filter((comment) => !comment.deleted).length
      requiredValues.push(
        source.values.content,
        source.values.images,
        source.values.linkedLink,
        source.comments.filter((comment) => !comment.deleted).map((comment) => comment.avatar),
      )
      if (
        source.values.linkedArticleId &&
        postPlans.find((post) => post.sourceId === source.values.linkedArticleId)?.skip &&
        !linkedArticleId
      )
        errors.push(zh('backup.planMomentPostDeleted', { sourceId: source.sourceId }))
    }
    return {
      sourceId: source.sourceId,
      title: source.values.content?.slice(0, 100) ?? '',
      skip,
      linkedArticleId,
      reason: zh(skip ? 'backup.planSkipSameWithComments' : 'backup.planMomentCreate'),
    }
  })
  return { momentPlans, comments }
}
