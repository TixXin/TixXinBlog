/**
 * @file content-import-item-plans.ts
 * @description 迁入计划中图库、项目、友链、提示词与订阅的去重判定与计划生成。
 */
import type {
  PackageGalleryPhoto,
  PackageImagePrompt,
  PackageLink,
  PackageProject,
  PackageSubscription,
} from './content-package'
import { zh } from '../../common/i18n'
import { promptContentHash, subscriptionContentHash } from './content-import-hashes'

export type ImportItemPlan = { sourceId: number; title: string; skip: boolean; reason: string }

export function buildGalleryPlans(
  gallery: PackageGalleryPhoto[],
  strategy: 'skip' | 'copy',
  existingGallery: Set<string>,
  incomingHash: (type: 'gallery', id: number) => string,
  requiredValues: unknown[],
): ImportItemPlan[] {
  return gallery.map((source) => {
    const hash = incomingHash('gallery', source.sourceId)
    const skip = source.deleted || (strategy === 'skip' && existingGallery.has(hash))
    if (!skip) {
      existingGallery.add(hash)
      if (source.values.mediaId) requiredValues.push(`/api/v1/media/${source.values.mediaId}.webp`)
    }
    return {
      sourceId: source.sourceId,
      title: source.values.title,
      skip,
      reason: zh(
        source.deleted
          ? 'backup.planGallerySkipDeleted'
          : skip
            ? 'backup.planGallerySkipSame'
            : 'backup.planGalleryCreate',
      ),
    }
  })
}

export function buildProjectPlans(
  projects: PackageProject[],
  strategy: 'skip' | 'copy',
  existingProjects: Set<string>,
  incomingHash: (type: 'project', id: number) => string,
  requiredValues: unknown[],
): ImportItemPlan[] {
  return projects.map((source) => {
    const hash = incomingHash('project', source.sourceId)
    const skip = source.deleted || (strategy === 'skip' && existingProjects.has(hash))
    if (!skip) {
      existingProjects.add(hash)
      if (source.values.coverMediaId) requiredValues.push(`/api/v1/media/${source.values.coverMediaId}.webp`)
    }
    return {
      sourceId: source.sourceId,
      title: source.values.title,
      skip,
      reason: zh(
        source.deleted
          ? 'backup.planProjectSkipDeleted'
          : skip
            ? 'backup.planProjectSkipSame'
            : 'backup.planProjectCreate',
      ),
    }
  })
}

export function buildLinkPlans(
  links: PackageLink[],
  strategy: 'skip' | 'copy',
  occupiedLinks: Set<string>,
  requiredValues: unknown[],
): ImportItemPlan[] {
  return links.map((source) => {
    const duplicate = occupiedLinks.has(source.values.url)
    const skip = source.deleted || (strategy === 'skip' && duplicate)
    if (!skip) {
      occupiedLinks.add(source.values.url)
      if (source.values.logoMediaId) requiredValues.push(`/api/v1/media/${source.values.logoMediaId}.webp`)
    }
    return {
      sourceId: source.sourceId,
      title: source.values.name,
      skip,
      reason: zh(
        source.deleted
          ? 'backup.planLinkSkipDeleted'
          : skip
            ? 'backup.planLinkSkipSame'
            : duplicate
              ? 'backup.planLinkCopy'
              : 'backup.planLinkCreate',
      ),
    }
  })
}

export function buildPromptPlans(
  prompts: PackageImagePrompt[],
  strategy: 'skip' | 'copy',
  existingPrompts: Set<string>,
  requiredValues: unknown[],
): ImportItemPlan[] {
  return prompts.map((source) => {
    const hash = promptContentHash(source.values)
    const skip = strategy === 'skip' && existingPrompts.has(hash)
    if (!skip) {
      existingPrompts.add(hash)
      if (source.values.mediaId) requiredValues.push(`/api/v1/media/${source.values.mediaId}.webp`)
    }
    return {
      sourceId: source.sourceId,
      title: source.values.title,
      skip,
      reason: zh(skip ? 'backup.planPromptSkipSame' : 'backup.planPromptCreate'),
    }
  })
}

export function buildSubscriptionPlans(
  subscriptions: PackageSubscription[],
  strategy: 'skip' | 'copy',
  existingSubscriptions: Set<string>,
  requiredValues: unknown[],
): ImportItemPlan[] {
  return subscriptions.map((source) => {
    const hash = subscriptionContentHash(source.values)
    const skip = source.deleted || (strategy === 'skip' && existingSubscriptions.has(hash))
    if (!skip) {
      existingSubscriptions.add(hash)
      if (source.values.iconMediaId) requiredValues.push(`/api/v1/media/${source.values.iconMediaId}.webp`)
    }
    return {
      sourceId: source.sourceId,
      title: source.values.name,
      skip,
      reason: zh(
        source.deleted
          ? 'backup.planSubscriptionSkipDeleted'
          : skip
            ? 'backup.planSubscriptionSkipSame'
            : 'backup.planSubscriptionCreate',
      ),
    }
  })
}
