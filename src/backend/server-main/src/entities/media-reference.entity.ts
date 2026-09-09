/**
 * @file media-reference.entity.ts
 * @description 媒体引用索引，随内容事务更新，覆盖当前文章、修订和闪念。
 */
import { Entity, ManyToOne, PrimaryKey, Property, Unique } from '@mikro-orm/core'
import { MediaAsset } from './media-asset.entity'
import { Post } from './post.entity'
import { FlashNote } from './flash-note.entity'
import { Comment } from './comment.entity'
import { FlashComment } from './flash-comment.entity'
import { Moment } from './moment.entity'
import { MomentComment } from './moment-comment.entity'
@Entity({ tableName: 'media_reference' })
@Unique({ properties: ['asset', 'sourceKey'] })
export class MediaReference {
  @PrimaryKey({ type: 'integer', autoincrement: true }) id!: number
  @ManyToOne({ entity: () => MediaAsset, deleteRule: 'restrict' }) asset!: MediaAsset
  @Property({ type: 'text' }) sourceKey!: string
  @Property({ type: 'text' }) kind!:
    'post' | 'revision' | 'flash' | 'site' | 'site-revision' | 'comment' | 'flash-comment' | 'moment' | 'moment-comment'
  @ManyToOne({ entity: () => Post, nullable: true, deleteRule: 'cascade' }) post?: Post
  @ManyToOne({ entity: () => FlashNote, nullable: true, deleteRule: 'cascade' }) flashNote?: FlashNote
  @Property({ type: 'integer', nullable: true }) revision?: number
  @ManyToOne({ entity: () => Comment, nullable: true, deleteRule: 'cascade' }) comment?: Comment
  @ManyToOne({ entity: () => FlashComment, nullable: true, deleteRule: 'cascade' }) flashComment?: FlashComment
  @ManyToOne({ entity: () => Moment, nullable: true, deleteRule: 'cascade' }) moment?: Moment
  @ManyToOne({ entity: () => MomentComment, nullable: true, deleteRule: 'cascade' }) momentComment?: MomentComment
}
