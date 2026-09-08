/**
 * @file audit-entry.entity.ts
 * @description 管理写入的持久化意图及结果，仅保存操作者、对象、字段名和必要计数。
 */
import { Entity, Index, OptionalProps, PrimaryKey, Property } from '@mikro-orm/core'
import { randomUUID } from 'node:crypto'
export type AuditState = 'pending' | 'success' | 'partial' | 'failure' | 'unknown'
export interface AuditSummary {
  fields: string[]
  submittedVersion?: number
  currentVersion?: number
  counts?: Record<string, number>
  targetState?: string
}
@Entity({ tableName: 'audit_entry' })
export class AuditEntry {
  [OptionalProps]?: 'id' | 'createdAt'
  @PrimaryKey({ type: 'uuid' }) id: string = randomUUID()
  @Property({ type: 'uuid', nullable: true }) @Index() actorId?: string
  @Property({ type: 'text', nullable: true }) actorName?: string
  @Property({ type: 'uuid', nullable: true }) sessionId?: string
  @Property({ type: 'uuid', nullable: true }) traceId?: string
  @Property({ type: 'text' }) @Index() action!: string
  @Property({ type: 'text' }) resourceType!: string
  @Property({ type: 'text', nullable: true }) resourceId?: string
  @Property({ type: 'text' }) @Index() state!: AuditState
  @Property({ type: 'integer', nullable: true }) statusCode?: number
  @Property({ type: 'json' }) summary!: AuditSummary
  @Property({ type: 'datetime' }) @Index() createdAt: Date = new Date()
  @Property({ type: 'datetime', nullable: true }) finishedAt?: Date
}
