/** @file background-task.entity.ts @description 持久任务、有限重试与租约；投递不确定状态禁止自动重投 */
import { Entity, Index, PrimaryKey, Property, Unique } from '@mikro-orm/core'
export type BackgroundTaskState =
  'queued' | 'running' | 'retry' | 'succeeded' | 'failed' | 'uncertain' | 'paused' | 'restored'
export type BackgroundTaskKind = 'mail' | 'backup'
@Entity({ tableName: 'background_task' })
@Index({ name: 'background_task_due_index', properties: ['kind', 'state', 'availableAt'] })
export class BackgroundTask {
  @PrimaryKey({ type: 'uuid' }) id!: string
  @Property({ type: 'text' }) @Unique() dedupeKey!: string
  @Property({ type: 'text' }) kind!: BackgroundTaskKind
  @Property({ type: 'text' }) state!: BackgroundTaskState
  @Property({ type: 'uuid' }) generation!: string
  @Property({ type: 'json' }) payload!: { notificationId?: string }
  @Property({ type: 'json', nullable: true }) result?: Record<string, unknown>
  @Property({ type: 'integer', default: 0 }) attempts = 0
  @Property({ type: 'integer', default: 3 }) maxAttempts = 3
  @Property({ type: 'datetime' }) availableAt = new Date()
  @Property({ type: 'uuid', nullable: true }) leaseToken?: string
  @Property({ type: 'datetime', nullable: true }) leaseUntil?: Date
  @Property({ type: 'datetime', nullable: true }) startedAt?: Date
  @Property({ type: 'datetime', nullable: true }) finishedAt?: Date
  @Property({ type: 'text', nullable: true }) errorCode?: string
  @Property({ type: 'datetime' }) createdAt = new Date()
}
