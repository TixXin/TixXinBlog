/**
 * @file content-import-plan-summary.ts
 * @description 迁入计划的最终组装与计数汇总；字段顺序与确认哈希的输入保持一致。
 */
import type { ContentImportPlan } from '../../entities/content-import.entity'
import type { makeRelationMapping } from './content-relation-plan'
import type { PlanContext, ShowcaseRowPlans, SocialRowPlans } from './content-import-plan-rows'

export interface PlanSummaryInput {
  context: PlanContext
  social: SocialRowPlans
  showcase: ShowcaseRowPlans
  media: ContentImportPlan['media']
  relations: ReturnType<typeof makeRelationMapping>
  errors: string[]
  includeSettings: boolean
}

type PlanRows = { skip: boolean }[]

const created = (rows: PlanRows) => rows.filter((item) => !item.skip).length
const skipped = (rows: PlanRows) => rows.filter((item) => item.skip).length

function planCounts({ social, showcase, media, includeSettings }: PlanSummaryInput): ContentImportPlan['counts'] {
  const { posts, flashes, moments, guestbook } = social
  const { gallery, projects, links, prompts, subscriptions } = showcase
  const rows = [
    posts.postPlans,
    flashes.flashPlans,
    moments.momentPlans,
    guestbook,
    gallery,
    projects,
    links,
    prompts,
    subscriptions,
  ]
  return {
    posts: created(posts.postPlans),
    flashes: created(flashes.flashPlans),
    moments: created(moments.momentPlans),
    guestbook: created(guestbook),
    gallery: created(gallery),
    projects: created(projects),
    links: created(links),
    prompts: created(prompts),
    subscriptions: created(subscriptions),
    comments: posts.comments + flashes.comments + moments.comments,
    skipped: rows.reduce((sum, items) => sum + skipped(items), 0),
    media: media.filter((item) => item.create).length,
    files: media.filter((item) => item.writeFile).length,
    settings: includeSettings,
  }
}

export function assembleContentPlan(input: PlanSummaryInput): ContentImportPlan {
  const { context, social, showcase, media, relations, errors } = input
  return {
    basis: context.basis,
    relationMapping: relations.mapping,
    omittedRelations: relations.omitted,
    ready: errors.length === 0,
    errors: [...new Set(errors)],
    posts: social.posts.postPlans,
    flashes: social.flashes.flashPlans,
    moments: social.moments.momentPlans,
    guestbook: social.guestbook,
    gallery: showcase.gallery,
    projects: showcase.projects,
    links: showcase.links,
    prompts: showcase.prompts,
    subscriptions: showcase.subscriptions,
    media,
    counts: planCounts(input),
    siteRevision: context.site.revision,
    policyRevision: context.policy.revision,
    gallerySettingsRevision: context.gallerySettings.revision,
    linkSettingsRevision: context.linkSettings.revision,
  }
}
