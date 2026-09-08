/**
 * @file post-batch-operation.entity.ts
 * @description 持久化批量预览与逐项结果，支持断线查询和幂等重试。
 */
import { Entity, Index, OptionalProps, PrimaryKey, Property } from '@mikro-orm/core'
import { randomUUID } from 'node:crypto'
export interface PostBatchImpact {
  comments: number
  commentLikes: number
  revisions: number
  addresses: number
  mediaReferences: number
  likes: number
  views: number
}
export interface PostBatchPlanItem {
  id: number
  revision: number
  title: string
  status: string
  deleted: boolean
  allowed: boolean
  reason: string
  fingerprint: string
  impact: PostBatchImpact
}
export interface PostBatchResult {
  id: number
  success: boolean
  message: string
}
@Entity({ tableName: 'post_batch_operation' })
export class PostBatchOperation {
  [OptionalProps]?: 'id' | 'createdAt'
  @PrimaryKey({ type: 'uuid' }) id: string = randomUUID()
  @Property({ type: 'uuid' }) @Index() actorId!: string
  @Property({ type: 'text' }) actorName!: string
  @Property({ type: 'integer' }) sessionVersion!: number
  @Property({ type: 'text' }) action!: string
  @Property({ type: 'json' }) plan!: PostBatchPlanItem[]
  @Property({ type: 'json' }) results!: PostBatchResult[]
  @Property({ type: 'datetime' }) @Index() createdAt: Date = new Date()
  @Property({ type: 'datetime' }) expiresAt!: Date
  @Property({ type: 'datetime', nullable: true }) startedAt?: Date
  @Property({ type: 'datetime', nullable: true }) finishedAt?: Date
}
