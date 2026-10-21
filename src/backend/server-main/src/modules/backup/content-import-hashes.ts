/**
 * @file content-import-hashes.ts
 * @description 迁入内容去重比对的各项内容哈希计算纯函数。
 */
import { packageHash } from './content-package'
import type {
  ContentPackage,
  PackageFlash,
  PackageGalleryPhoto,
  PackageImagePrompt,
  PackageMoment,
  PackagePost,
  PackageProject,
  PackageSubscription,
} from './content-package'
import type { PostAddress } from '../../entities/post-address.entity'
import type { TaxonomyAlias } from '../../entities/taxonomy-alias.entity'
import type { SiteSettings } from '../../entities/site-settings.entity'
import type { CommentPolicy } from '../../entities/comment-policy.entity'
import type { GallerySettings } from '../../entities/gallery-settings.entity'
import type { LinkSettings } from '../../entities/link-settings.entity'

export function postContentHash(values: PackagePost['values']): string {
  return packageHash({
    title: values.title.trim(),
    summary: values.summary ?? '',
    cover: values.cover ?? '',
    coverAlt: values.coverAlt ?? '',
    seoTitle: values.seoTitle ?? '',
    seoDescription: values.seoDescription ?? '',
    seoNoindex: values.seoNoindex ?? false,
    category: values.category,
    folder: values.folder.trim(),
    contentRaw: values.contentRaw ?? '',
    pinned: values.pinned ?? false,
    readTimeMinutes: values.readTimeMinutes ?? 5,
    tags: [...new Set(values.tags.map((tag) => tag.trim()))].sort(),
  })
}

export function flashContentHash(values: PackageFlash['values']): string {
  return packageHash({
    content: values.content?.trim() ?? '',
    tags: [...new Set((values.tags ?? []).map((tag) => tag.trim()))].sort(),
    images: values.images ?? [],
    type: values.type ?? 'memo',
    isPinned: values.isPinned ?? false,
  })
}

export function momentContentHash(values: PackageMoment['values'], articleHash: string | null): string {
  return packageHash({
    content: values.content?.trim() ?? '',
    topics: [...new Set(values.topics ?? [])].sort(),
    images: values.images ?? [],
    location: values.location || null,
    device: values.device || null,
    mood: values.mood || null,
    linkedLink: values.linkedLink ?? null,
    articleHash,
    isPinned: values.isPinned ?? false,
  })
}

export function galleryContentHash(values: PackageGalleryPhoto['values']): string {
  const { status, relatedContent, ...content } = values
  // 发布状态不参与内容去重，避免已迁入草稿被下一次跳过策略重复创建。
  void status
  void relatedContent
  return packageHash({ ...content, externalUrl: values.externalUrl ?? null })
}

export function projectContentHash(values: PackageProject['values']): string {
  const { status, relatedContent, ...content } = values
  // 项目进展属于业务内容；站点发布状态不参与去重，草稿迁入后仍可识别同一内容。
  void status
  void relatedContent
  return packageHash(content)
}

export function promptContentHash(values: PackageImagePrompt['values']): string {
  const { status, ...content } = values
  // 发布状态不参与去重，重复迁入已转为草稿的提示词仍能识别。
  void status
  return packageHash({ ...content, tags: [...new Set(values.tags)].sort() })
}

export function subscriptionContentHash(values: PackageSubscription['values']): string {
  const { status, faviconDomain, ...content } = values
  // 保留完整历史和业务状态参与去重；发布状态及可再生图标缓存不改变内容身份。
  void status
  void faviconDomain
  return packageHash(content)
}

export function calculateImportBasis(params: {
  generation: string
  current: ContentPackage
  aliases: TaxonomyAlias[]
  addresses: PostAddress[]
  includeSettings: boolean
  site: SiteSettings
  policy: CommentPolicy
  input: ContentPackage
  gallerySettings: GallerySettings
  linkSettings: LinkSettings
}): string {
  const {
    generation,
    current,
    aliases,
    addresses,
    includeSettings,
    site,
    policy,
    input,
    gallerySettings,
    linkSettings,
  } = params
  return packageHash({
    context: generation,
    guestbook: current.guestbook,
    gallery: current.gallery,
    projects: current.projects,
    links: current.links,
    prompts: current.prompts ?? [],
    subscriptions: current.subscriptions ?? [],
    posts: current.posts.map((post) => ({ id: post.sourceId, values: post.values })),
    flashes: current.flashes.map((flash) => ({ id: flash.sourceId, values: flash.values })),
    moments: current.moments.map((note) => ({
      id: note.sourceId,
      values: note.values,
      deleted: note.deleted,
      comments: note.comments,
    })),
    folders: current.folders,
    tags: current.tags,
    aliases: aliases.map((alias) => ({ kind: alias.kind, alias: alias.alias, target: alias.target })),
    addresses: addresses.map((item) => ({ slug: item.slug, post: item.post.id })),
    media: current.media.map((item) => ({ id: item.id, sha256: item.sha256, deleted: item.deleted })),
    settings: includeSettings
      ? [
          site.revision,
          policy.revision,
          input.gallerySettings ? gallerySettings.revision : null,
          input.linkSettings ? linkSettings.revision : null,
        ]
      : null,
  })
}
