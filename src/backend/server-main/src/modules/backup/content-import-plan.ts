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
import { createRelationHasher, makeRelationMapping } from './content-relation-plan'
import type { ContentRelationType } from '../../common/types/content-relation'
import { zh } from '../../common/i18n'
import {
  calculateImportBasis,
  galleryContentHash,
  postContentHash,
  projectContentHash,
  promptContentHash,
  subscriptionContentHash,
} from './content-import-hashes'
import { makeMediaImportPlan } from './content-import-media-plan'
import {
  buildShowcaseRowPlans,
  buildSocialRowPlans,
  type ContentPlanParams,
  type PlanContext,
} from './content-import-plan-rows'
import { assembleContentPlan } from './content-import-plan-summary'

export { promptContentHash, subscriptionContentHash }
export type { ContentPlanParams }

export async function normalizedPost(em: EntityManager, values: PackagePost['values']) {
  return {
    ...values,
    folder: await canonicalTaxonomyLabel(em, 'folders', values.folder.trim()),
    tags: [
      ...new Set(await Promise.all(values.tags.map((tag) => canonicalTaxonomyLabel(em, 'tags', tag.trim())))),
    ].sort(),
  }
}

export async function makeContentPlan(params: ContentPlanParams): Promise<ContentImportPlan> {
  const { em, storage, input, includeSettings } = params
  const context = await loadPlanContext(params)
  const errors: string[] = []
  const requiredValues: unknown[] = []
  const rowInput = { params, context, errors, requiredValues }
  const social = await buildSocialRowPlans(rowInput)
  const showcase = buildShowcaseRowPlans(rowInput)
  const media = await makeMediaImportPlan(input, context.current, requiredValues, storage, includeSettings, errors)
  await checkTaxonomyLabels(em, input, errors)
  const relations = makeRelationMapping(
    context.current,
    input,
    { post: social.posts.postPlans, project: showcase.projects, gallery: showcase.gallery },
    context.currentHash,
    (type, id) => (type === 'post' ? social.sourcePostHashes.get(id)! : context.incomingHash(type, id)),
  )
  errors.push(...relations.errors)
  return assembleContentPlan({ context, social, showcase, media, relations, errors, includeSettings })
}

/** 预览绑定的当前快照、地址、目录别名、设置修订与内容上下文。 */
async function loadPlanContext({ em, exporter, input, includeSettings }: ContentPlanParams): Promise<PlanContext> {
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
  return { current, currentHash, incomingHash, addresses, site, policy, gallerySettings, linkSettings, basis }
}

/** 包内专栏与标签须能映射到现有目录；逐个顺序核对，错误按原文登记。 */
async function checkTaxonomyLabels(em: EntityManager, input: ContentPackage, errors: string[]) {
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
}
