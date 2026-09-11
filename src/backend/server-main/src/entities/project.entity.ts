/** @file project.entity.ts @description 可维护的个人项目，项目进展与站点发布状态独立，封面引用真实媒体 */
import { Entity, Index, ManyToOne, OptionalProps, PrimaryKey, Property, Unique } from '@mikro-orm/core'
import { MediaAsset } from './media-asset.entity'
import type { ContentRelation } from '../common/types/content-relation'
export const PROJECT_PROGRESS = ['active', 'dev', 'archived'] as const
export const PROJECT_STATUSES = ['draft', 'published', 'withdrawn'] as const
export const PROJECT_TAG_COLORS = ['emerald', 'blue', 'amber', 'sky', 'rose', 'slate'] as const
export const PROJECT_LINK_KINDS = ['source', 'demo', 'docs', 'download'] as const
export type ProjectProgress = (typeof PROJECT_PROGRESS)[number]
export type ProjectStatus = (typeof PROJECT_STATUSES)[number]
export interface ProjectTag {
  label: string
  color: (typeof PROJECT_TAG_COLORS)[number]
}
export interface ProjectLink {
  kind: (typeof PROJECT_LINK_KINDS)[number]
  href: string
}
@Entity({ tableName: 'project' })
@Index({ name: 'project_visibility_order_idx', properties: ['status', 'deletedAt', 'sortOrder', 'id'] })
@Unique({ properties: ['requestId'] })
export class Project {
  [OptionalProps]?:
    | 'id'
    | 'description'
    | 'tags'
    | 'links'
    | 'progress'
    | 'status'
    | 'sortOrder'
    | 'revision'
    | 'createdAt'
    | 'updatedAt'
    | 'relatedContent'
  @Property({ type: 'json', defaultRaw: "'[]'::jsonb" }) relatedContent: ContentRelation[] = []
  @PrimaryKey({ type: 'integer', autoincrement: true }) id!: number
  @Property({ type: 'text' }) title!: string
  @Property({ type: 'text', default: '' }) description: string = ''
  @ManyToOne({ entity: () => MediaAsset, nullable: true, deleteRule: 'restrict' }) coverMedia?: MediaAsset | null
  @Property({ type: 'json', defaultRaw: "'[]'::jsonb" }) tags: ProjectTag[] = []
  @Property({ type: 'json', defaultRaw: "'[]'::jsonb" }) links: ProjectLink[] = []
  @Property({ type: 'text', default: 'dev' }) progress: ProjectProgress = 'dev'
  @Property({ type: 'text', default: 'draft' }) status: ProjectStatus = 'draft'
  @Property({ type: 'integer', default: 0 }) sortOrder: number = 0
  @Property({ type: 'integer', default: 0 }) revision: number = 0
  @Property({ type: 'text', nullable: true }) requestId?: string
  @Property({ type: 'text', nullable: true }) requestHash?: string
  @Property({ type: 'datetime', nullable: true }) publishedAt?: Date | null
  @Property({ type: 'datetime', nullable: true }) deletedAt?: Date | null
  @Property({ type: 'datetime' }) createdAt: Date = new Date()
  @Property({ type: 'datetime', onUpdate: () => new Date() }) updatedAt: Date = new Date()
}
