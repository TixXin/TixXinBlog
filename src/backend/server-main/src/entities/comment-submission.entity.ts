/** @file comment-submission.entity.ts @description 评论提交凭据在评论删除后仍保留，避免响应丢失重试复活互动 */
import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core'
import { Comment } from './comment.entity'
@Entity({ tableName: 'comment_submission' })
export class CommentSubmission {
  @PrimaryKey({ type: 'text' }) id!: string
  @Property({ type: 'text' }) requestHash!: string
  @ManyToOne({ entity: () => Comment, nullable: true, deleteRule: 'set null' }) comment?: Comment | null
  @Property({ type: 'datetime' }) createdAt = new Date()
}
