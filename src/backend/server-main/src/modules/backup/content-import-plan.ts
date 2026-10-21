/**
 * @file content-import-plan.ts
 * @description 只创建新草稿或跳过相同内容；预览绑定当前内容、目录、地址与媒体状态。
 */
import type { EntityManager } from '@mikro-orm/postgresql'
import { PostAddress } from '../../entities/post-address.entity'
import { TaxonomyAlias } from '../../entities/taxonomy-alias.entity'
import { SiteSettings } from '../../entities/site-settings.entity'
import { CommentPolicy } from '../../entities/comment-policy.entity'
import { ContentContext } from '../../entities/content-context.entity'
import { GallerySettings } from '../../entities/gallery-settings.entity'
import { LinkSettings } from '../../entities/link-settings.entity'
import type { ContentImportPlan } from '../../entities/content-import.entity'
import type { ContentPackage, PackageGalleryPhoto, PackagePost, PackageProject } from './content-package'
import { canonicalTaxonomyLabel } from '../post/taxonomy-aliases'
import type { MediaStorage } from '../media/media-storage'
import type { ContentExportService } from './content-export.service'
import { guestbookImportPlan } from './content-guestbook-plan'
import { createRelationHasher, makeRelationMapping } from './content-relation-plan'
import type { ContentRelationType } from '../../common/types/content-relation'
import { zh } from '../../common/i18n'
import {
  calculateImportBasis,
  flashContentHash,
  galleryContentHash,
  momentContentHash,
  postContentHash,
  projectContentHash,
  promptContentHash,
  subscriptionContentHash,
} from './content-import-hashes'
import { makeMediaImportPlan } from './content-import-media-plan'
import { buildFlashPlans, buildMomentPlans, buildPostPlans } from './content-import-social-plans'
import {
  buildGalleryPlans,
  buildLinkPlans,
  buildProjectPlans,
  buildPromptPlans,
  buildSubscriptionPlans,
} from './content-import-item-plans'

export { promptContentHash, subscriptionContentHash }

export async function normalizedPost(em: EntityManager, values: PackagePost['values']) {
  return {
    ...values,
    folder: await canonicalTaxonomyLabel(em, 'folders', values.folder.trim()),
    tags: [
      ...new Set(await Promise.all(values.tags.map((tag) => canonicalTaxonomyLabel(em, 'tags', tag.trim())))),
    ].sort(),
  }
}

export async function makeContentPlan(
  em: EntityManager,
  exporter: ContentExportService,
  storage: MediaStorage,
  input: ContentPackage,
  strategy: 'skip' | 'copy',
  includeSettings: boolean,
  ticket: string,
): Promise<ContentImportPlan> {
  const current = await exporter.snapshot(false, em)
  const hashBase = (type: ContentRelationType, values: unknown) =>
    type === 'post'
      ? postContentHash(values as PackagePost['values'])
      : type === 'project'
        ? projectContentHash(values as PackageProject['values'])
        : galleryContentHash(values as PackageGalleryPhoto['values'])
  const currentHash = createRelationHasher(current, hashBase),
    incomingHash = createRelationHasher(input, hashBase)
  const [addresses, aliases, site, policy, context, gallerySettings, linkSettings] = await Promise.all([
    em.find(PostAddress, {}, { orderBy: { slug: 'asc' } }),
    em.find(TaxonomyAlias, {}, { orderBy: { kind: 'asc', alias: 'asc' } }),
    em.findOneOrFail(SiteSettings, { id: 'default' }),
    em.findOneOrFail(CommentPolicy, { id: 'default' }),
    em.findOneOrFail(ContentContext, { id: 'default' }),
    em.findOneOrFail(GallerySettings, { id: 'default' }),
    em.findOneOrFail(LinkSettings, { id: 'default' }),
  ])
  const basis = calculateImportBasis({
    generation: context.generation,
    current,
    aliases,
    addresses,
    includeSettings,
    site,
    policy,
    input,
    gallerySettings,
    linkSettings,
  })
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
  const errors: string[] = []
  const requiredValues: unknown[] = []

  const { postPlans, comments: postComments } = await buildPostPlans(
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

  const { flashPlans, comments: flashComments } = buildFlashPlans(
    input.flashes,
    strategy,
    existingFlashes,
    requiredValues,
  )

  const { momentPlans, comments: momentComments } = buildMomentPlans(
    input.moments ?? [],
    strategy,
    existingMoments,
    sourcePostHashes,
    currentPostHashes,
    current.posts,
    postPlans,
    requiredValues,
    errors,
  )

  const guestbookPlans = guestbookImportPlan(current.guestbook, input.guestbook ?? [], strategy)
  const guestbookById = new Map((input.guestbook ?? []).map((message) => [message.sourceId, message]))
  for (const plan of guestbookPlans) {
    const source = guestbookById.get(plan.sourceId)!
    if (!plan.skip && !source.deleted) requiredValues.push(source.avatar)
  }

  const existingGallery = new Set(
    current.gallery.filter((photo) => !photo.deleted).map((photo) => currentHash('gallery', photo.sourceId)),
  )
  const galleryPlans = buildGalleryPlans(input.gallery ?? [], strategy, existingGallery, incomingHash, requiredValues)

  const existingProjects = new Set(
    current.projects.filter((project) => !project.deleted).map((project) => currentHash('project', project.sourceId)),
  )
  const projectPlans = buildProjectPlans(input.projects ?? [], strategy, existingProjects, incomingHash, requiredValues)

  const occupiedLinks = new Set(current.links.filter((link) => !link.deleted).map((link) => link.values.url))
  const linkPlans = buildLinkPlans(input.links ?? [], strategy, occupiedLinks, requiredValues)

  const existingPrompts = new Set((current.prompts ?? []).map((prompt) => promptContentHash(prompt.values)))
  const promptPlans = buildPromptPlans(input.prompts ?? [], strategy, existingPrompts, requiredValues)

  const existingSubscriptions = new Set(
    (current.subscriptions ?? []).map((subscription) => subscriptionContentHash(subscription.values)),
  )
  const subscriptionPlans = buildSubscriptionPlans(
    input.subscriptions ?? [],
    strategy,
    existingSubscriptions,
    requiredValues,
  )

  const media = await makeMediaImportPlan(input, current, requiredValues, storage, includeSettings, errors)
  for (const label of input.folders) {
    try {
      await canonicalTaxonomyLabel(em, 'folders', label)
    } catch {
      errors.push(zh('backup.planFolderUnmapped', { label }))
    }
  }
  for (const tag of input.tags) {
    try {
      await canonicalTaxonomyLabel(em, 'tags', tag.label)
    } catch {
      errors.push(zh('backup.planTagUnmapped', { label: tag.label }))
    }
  }
  const relations = makeRelationMapping(
    current,
    input,
    { post: postPlans, project: projectPlans, gallery: galleryPlans },
    currentHash,
    (type, id) => (type === 'post' ? sourcePostHashes.get(id)! : incomingHash(type, id)),
  )
  errors.push(...relations.errors)
  return {
    basis,
    relationMapping: relations.mapping,
    omittedRelations: relations.omitted,
    ready: errors.length === 0,
    errors: [...new Set(errors)],
    posts: postPlans,
    flashes: flashPlans,
    moments: momentPlans,
    guestbook: guestbookPlans,
    gallery: galleryPlans,
    projects: projectPlans,
    links: linkPlans,
    prompts: promptPlans,
    subscriptions: subscriptionPlans,
    media,
    counts: {
      posts: postPlans.filter((item) => !item.skip).length,
      flashes: flashPlans.filter((item) => !item.skip).length,
      moments: momentPlans.filter((item) => !item.skip).length,
      guestbook: guestbookPlans.filter((item) => !item.skip).length,
      gallery: galleryPlans.filter((item) => !item.skip).length,
      projects: projectPlans.filter((item) => !item.skip).length,
      links: linkPlans.filter((item) => !item.skip).length,
      prompts: promptPlans.filter((item) => !item.skip).length,
      subscriptions: subscriptionPlans.filter((item) => !item.skip).length,
      comments: postComments + flashComments + momentComments,
      skipped:
        postPlans.filter((item) => item.skip).length +
        flashPlans.filter((item) => item.skip).length +
        momentPlans.filter((item) => item.skip).length +
        guestbookPlans.filter((item) => item.skip).length +
        galleryPlans.filter((item) => item.skip).length +
        projectPlans.filter((item) => item.skip).length +
        linkPlans.filter((item) => item.skip).length +
        promptPlans.filter((item) => item.skip).length +
        subscriptionPlans.filter((item) => item.skip).length,
      media: media.filter((item) => item.create).length,
      files: media.filter((item) => item.writeFile).length,
      settings: includeSettings,
    },
    siteRevision: site.revision,
    policyRevision: policy.revision,
    gallerySettingsRevision: gallerySettings.revision,
    linkSettingsRevision: linkSettings.revision,
  }
}
