/**
 * @file comment-policy.entity.ts
 * @description 可运行时修改的评论审核策略，默认保留原有直接公开行为。
 */
import { Entity, PrimaryKey, Property } from '@mikro-orm/core'
@Entity({ tableName: 'comment_policy' })
export class CommentPolicy {
  @PrimaryKey({ type: 'text' }) id!: string
  @Property({ type: 'boolean', default: false }) requireApproval: boolean = false
  @Property({ type: 'integer', default: 0 }) revision: number = 0
  @Property({ type: 'datetime' }) updatedAt: Date = new Date()
}
