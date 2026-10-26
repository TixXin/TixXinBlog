/**
 * @file content-import-plan-rows.ts
 * @description 迁入计划的读取上下文与各内容域逐行计划；按原顺序登记引用媒体，保证媒体计划顺序不变。
 */
import type { EntityManager } from '@mikro-orm/postgresql'
import type { PostAddress } from '../../entities/post-address.entity'
import type { SiteSettings } from '../../entities/site-settings.entity'
import type { CommentPolicy } from '../../entities/comment-policy.entity'
import type { GallerySettings } from '../../entities/gallery-settings.entity'
import type { LinkSettings } from '../../entities/link-settings.entity'
import type { ContentImportPlan } from '../../entities/content-import.entity'
import type { ContentPackage } from './content-package'
import type { MediaStorage } from '../media/media-storage'
import type { ContentExportService } from './content-export.service'
import type { createRelationHasher } from './content-relation-plan'
import { guestbookImportPlan } from './content-guestbook-plan'
import {
  flashContentHash,
  momentContentHash,
  promptContentHash,
  subscriptionContentHash,
} from './content-import-hashes'
import { buildFlashPlans, buildMomentPlans, buildPostPlans } from './content-import-social-plans'
import {
  buildGalleryPlans,
  buildLinkPlans,
  buildProjectPlans,
  buildPromptPlans,
  buildSubscriptionPlans,
} from './content-import-item-plans'

export interface ContentPlanParams {
  em: EntityManager
  exporter: ContentExportService
  storage: MediaStorage
  input: ContentPackage
  strategy: 'skip' | 'copy'
  includeSettings: boolean
  ticket: string
}

type RelationHasher = ReturnType<typeof createRelationHasher>

export interface PlanContext {
  current: ContentPackage
  currentHash: RelationHasher
  incomingHash: RelationHasher
  addresses: PostAddress[]
  site: SiteSettings
  policy: CommentPolicy
  gallerySettings: GallerySettings
  linkSettings: LinkSettings
  basis: string
}

export interface RowPlanInput {
  params: ContentPlanParams
  context: PlanContext
  errors: string[]
  requiredValues: unknown[]
}

export type SocialRowPlans = Awaited<ReturnType<typeof buildSocialRowPlans>>
export type ShowcaseRowPlans = ReturnType<typeof buildShowcaseRowPlans>

/** 文章、闪念、朋友圈与留言：文章先行，朋友圈按文章计划映射关联。 */
export async function buildSocialRowPlans({ params, context, errors, requiredValues }: RowPlanInput) {
  const { em, input, strategy, ticket } = params
  const { current, currentHash, incomingHash, addresses } = context
  const existingPosts = new Set(current.posts.map((post) => currentHash('post', post.sourceId)))
  const existingFlashes = new Set(current.flashes.map((flash) => flashContentHash(flash.values)))
  const currentPostHashes = new Map(current.posts.map((post) => [post.sourceId, currentHash('post', post.sourceId)]))
  const sourcePostHashes = new Map<number, string>()
  const existingMoments = new Set(
    current.moments
      .filter((note) => !note.deleted)
      .map((note) =>
        momentContentHash(
          note.values,
          note.values.linkedArticleId ? (currentPostHashes.get(note.values.linkedArticleId) ?? null) : null,
        ),
      ),
  )
  const occupiedSlugs = new Set(addresses.map((address) => address.slug))
  const posts = await buildPostPlans(
    em,
    input.posts,
    incomingHash,
    existingPosts,
    occupiedSlugs,
    strategy,
    ticket,
    errors,
    requiredValues,
    sourcePostHashes,
  )
  const flashes = buildFlashPlans(input.flashes, strategy, existingFlashes, requiredValues)
  const moments = buildMomentPlans(
    input.moments ?? [],
    strategy,
    existingMoments,
    sourcePostHashes,
    currentPostHashes,
    current.posts,
    posts.postPlans,
    requiredValues,
    errors,
  )
  const guestbook = guestbookRowPlans(current, input, strategy, requiredValues)
  return { posts, flashes, moments, guestbook, sourcePostHashes }
}

function guestbookRowPlans(
  current: ContentPackage,
  input: ContentPackage,
  strategy: 'skip' | 'copy',
  requiredValues: unknown[],
): ContentImportPlan['guestbook'] {
  const guestbookPlans = guestbookImportPlan(current.guestbook, input.guestbook ?? [], strategy)
  const guestbookById = new Map((input.guestbook ?? []).map((message) => [message.sourceId, message]))
  for (const plan of guestbookPlans) {
    const source = guestbookById.get(plan.sourceId)!
    if (!plan.skip && !source.deleted) requiredValues.push(source.avatar)
  }
  return guestbookPlans
}

/** 图库、项目、友链、提示词与平台订阅：回收记录不迁入，按内容身份或地址去重。 */
export function buildShowcaseRowPlans({ params, context, requiredValues }: RowPlanInput) {
  const { input, strategy } = params
  const { current, currentHash, incomingHash } = context
  const existingGallery = new Set(
    current.gallery.filter((photo) => !photo.deleted).map((photo) => currentHash('gallery', photo.sourceId)),
  )
  const gallery = buildGalleryPlans(input.gallery ?? [], strategy, existingGallery, incomingHash, requiredValues)
  const existingProjects = new Set(
    current.projects.filter((project) => !project.deleted).map((project) => currentHash('project', project.sourceId)),
  )
  const projects = buildProjectPlans(input.projects ?? [], strategy, existingProjects, incomingHash, requiredValues)
  const occupiedLinks = new Set(current.links.filter((link) => !link.deleted).map((link) => link.values.url))
  const links = buildLinkPlans(input.links ?? [], strategy, occupiedLinks, requiredValues)
  const existingPrompts = new Set((current.prompts ?? []).map((prompt) => promptContentHash(prompt.values)))
  const prompts = buildPromptPlans(input.prompts ?? [], strategy, existingPrompts, requiredValues)
  const existingSubscriptions = new Set(
    (current.subscriptions ?? []).map((subscription) => subscriptionContentHash(subscription.values)),
  )
  const subscriptions = buildSubscriptionPlans(
    input.subscriptions ?? [],
    strategy,
    existingSubscriptions,
    requiredValues,
  )
  return { gallery, projects, links, prompts, subscriptions }
}
