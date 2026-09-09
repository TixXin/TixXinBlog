/**
 * @file content-import-plan.ts
 * @description 只创建新草稿或跳过相同内容；预览绑定当前内容、目录、地址与媒体状态。
 */
import type { EntityManager } from '@mikro-orm/postgresql'
import { createHash } from 'node:crypto'
import { PostAddress } from '../../entities/post-address.entity'
import { TaxonomyAlias } from '../../entities/taxonomy-alias.entity'
import { SiteSettings } from '../../entities/site-settings.entity'
import { CommentPolicy } from '../../entities/comment-policy.entity'
import { ContentContext } from '../../entities/content-context.entity'
import type { ContentImportPlan } from '../../entities/content-import.entity'
import type { ContentPackage, PackagePost, PackageFlash, PackageMoment } from './content-package'
import { packageHash } from './content-package'
import { canonicalTaxonomyLabel } from '../post/taxonomy-aliases'
import { managedMediaIds } from '../media/media-references'
import type { MediaStorage } from '../media/media-storage'
import type { ContentExportService } from './content-export.service'
import { guestbookImportPlan } from './content-guestbook-plan'
export function postContentHash(values: PackagePost['values']) {
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
export function flashContentHash(values: PackageFlash['values']) {
  return packageHash({
    content: values.content?.trim() ?? '',
    tags: [...new Set((values.tags ?? []).map((tag) => tag.trim()))].sort(),
    images: values.images ?? [],
    type: values.type ?? 'memo',
    isPinned: values.isPinned ?? false,
  })
}
export function momentContentHash(values: PackageMoment['values'], articleHash: string | null) {
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
  const [addresses, aliases, site, policy, context] = await Promise.all([
    em.find(PostAddress, {}, { orderBy: { slug: 'asc' } }),
    em.find(TaxonomyAlias, {}, { orderBy: { kind: 'asc', alias: 'asc' } }),
    em.findOneOrFail(SiteSettings, { id: 'default' }),
    em.findOneOrFail(CommentPolicy, { id: 'default' }),
    em.findOneOrFail(ContentContext, { id: 'default' }),
  ])
  const basis = packageHash({
    context: context.generation,
    guestbook: current.guestbook,
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
    settings: includeSettings ? [site.revision, policy.revision] : null,
  })
  const existingPosts = new Set(current.posts.map((post) => postContentHash(post.values)))
  const existingFlashes = new Set(current.flashes.map((flash) => flashContentHash(flash.values)))
  const currentPostHashes = new Map(current.posts.map((post) => [post.sourceId, postContentHash(post.values)]))
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
  const postPlans: ContentImportPlan['posts'] = []
  const requiredValues: unknown[] = []
  let comments = 0
  for (const source of input.posts) {
    let values = source.values
    try {
      values = await normalizedPost(em, source.values)
    } catch {
      errors.push(`文章 ${source.sourceId} 的历史目录名无法映射，请先调整目录`)
    }
    const hash = postContentHash(values)
    sourcePostHashes.set(source.sourceId, hash)
    const duplicate = existingPosts.has(hash)
    const skip = strategy === 'skip' && duplicate
    let slug = source.values.slug ?? ''
    let reason = skip ? '跳过相同内容及其评论' : duplicate ? '创建新的草稿副本，现有内容保留' : '创建新草稿'
    if (!skip && slug && occupiedSlugs.has(slug)) {
      slug = `${slug.slice(0, 90).replace(/-+$/, '')}-import-${ticket.slice(0, 8)}-${source.sourceId}`
      reason += '；原地址占用，使用新的地址标识'
    }
    if (!skip) {
      if (slug && occupiedSlugs.has(slug)) errors.push(`文章 ${source.sourceId} 的导入地址仍有冲突`)
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
  const flashPlans = input.flashes.map((source) => {
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
      reason: skip ? '跳过相同内容及其评论' : '创建新的闪念草稿',
    }
  })
  const momentPlans = (input.moments ?? []).map((source) => {
    const articleHash = source.values.linkedArticleId
      ? (sourcePostHashes.get(source.values.linkedArticleId) ?? null)
      : null
    const hash = momentContentHash(source.values, articleHash)
    const skip = strategy === 'skip' && existingMoments.has(hash)
    const linkedArticleId = articleHash
      ? (current.posts.find((post) => !post.deleted && currentPostHashes.get(post.sourceId) === articleHash)
          ?.sourceId ?? null)
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
        errors.push(`动态 ${source.sourceId} 的引用文章已删除，请选择创建副本或先恢复文章`)
    }
    return {
      sourceId: source.sourceId,
      title: source.values.content?.slice(0, 100) ?? '',
      skip,
      linkedArticleId,
      reason: skip ? '跳过相同内容及其评论' : '创建新的朋友圈草稿；保留未删除评论的审核状态；点赞和访客身份不迁入',
    }
  })
  const guestbookPlans = guestbookImportPlan(current.guestbook, input.guestbook ?? [], strategy)
  const guestbookById = new Map((input.guestbook ?? []).map((message) => [message.sourceId, message]))
  for (const plan of guestbookPlans) {
    const source = guestbookById.get(plan.sourceId)!
    if (!plan.skip && !source.deleted) requiredValues.push(source.avatar)
  }
  if (includeSettings) requiredValues.push(input.site.avatar)
  const required = new Set(managedMediaIds(requiredValues))
  const incoming = new Map(input.media.map((item) => [item.id, item]))
  const present = new Map(current.media.map((item) => [item.id, item]))
  for (const id of required) {
    if (!incoming.has(id) && !present.has(id)) errors.push(`内容引用未登记的媒体 ${id}`)
    if (present.get(id)?.deleted || (!present.has(id) && incoming.get(id)?.deleted))
      errors.push(`引用媒体 ${id} 处于回收状态，请先恢复资源`)
  }
  const media: ContentImportPlan['media'] = []
  for (const id of new Set([...incoming.keys(), ...required])) {
    const source = incoming.get(id),
      existing = present.get(id)
    if (!source && !existing) continue
    if (source && existing && source.sha256 !== existing.sha256) {
      errors.push(`媒体 ${id} 与现有文件标识冲突，不能覆盖`)
      continue
    }
    let file: Buffer | null = null
    if (required.has(id) || source?.base64) {
      try {
        file = await storage.readIfExists(`${id}.webp`)
      } catch {
        errors.push(`媒体 ${id} 当前无法读取`)
      }
      if (file && createHash('sha256').update(file).digest('hex') !== (existing?.sha256 ?? source?.sha256))
        errors.push(`媒体 ${id} 文件完整性不符，需要维护恢复`)
      if (!file && !source?.base64) errors.push(`缺少媒体 ${id} 的文件，请使用包含图片的内容包或先完成媒体恢复`)
    }
    const skip = !existing && !source?.base64 && !required.has(id)
    media.push({ id, create: !existing && !skip, writeFile: !file && !!source?.base64, skip })
  }
  for (const label of input.folders) {
    try {
      await canonicalTaxonomyLabel(em, 'folders', label)
    } catch {
      errors.push(`专栏历史名称 ${label} 无法映射`)
    }
  }
  for (const tag of input.tags) {
    try {
      await canonicalTaxonomyLabel(em, 'tags', tag.label)
    } catch {
      errors.push(`标签历史名称 ${tag.label} 无法映射`)
    }
  }
  return {
    basis,
    ready: errors.length === 0,
    errors: [...new Set(errors)],
    posts: postPlans,
    flashes: flashPlans,
    moments: momentPlans,
    guestbook: guestbookPlans,
    media,
    counts: {
      posts: postPlans.filter((item) => !item.skip).length,
      flashes: flashPlans.filter((item) => !item.skip).length,
      moments: momentPlans.filter((item) => !item.skip).length,
      guestbook: guestbookPlans.filter((item) => !item.skip).length,
      comments,
      skipped:
        postPlans.filter((item) => item.skip).length +
        flashPlans.filter((item) => item.skip).length +
        momentPlans.filter((item) => item.skip).length +
        guestbookPlans.filter((item) => item.skip).length,
      media: media.filter((item) => item.create).length,
      files: media.filter((item) => item.writeFile).length,
      settings: includeSettings,
    },
    siteRevision: site.revision,
    policyRevision: policy.revision,
  }
}
