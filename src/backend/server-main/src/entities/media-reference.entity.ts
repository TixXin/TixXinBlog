/**
 * @file media-reference.entity.ts
 * @description 媒体引用索引，随内容事务更新，覆盖当前文章、修订和闪念。
 */
import { Entity, Index, ManyToOne, PrimaryKey, Property, Unique } from '@mikro-orm/core'
import { MediaAsset } from './media-asset.entity'
import { Post } from './post.entity'
import { FlashNote } from './flash-note.entity'
import { Comment } from './comment.entity'
import { FlashComment } from './flash-comment.entity'
import { Moment } from './moment.entity'
import { MomentComment } from './moment-comment.entity'
import { GuestbookMessage } from './guestbook-message.entity'
import { GalleryPhoto } from './gallery-photo.entity'
import { Project } from './project.entity'
import { Subscription } from './subscription.entity'
import { FriendLink } from './friend-link.entity'
import { ImagePrompt } from './image-prompt.entity'
@Entity({ tableName: 'media_reference' })
@Unique({ properties: ['asset', 'sourceKey'] })
export class MediaReference {
  @PrimaryKey({ type: 'integer', autoincrement: true }) id!: number
  @ManyToOne({ entity: () => MediaAsset, deleteRule: 'restrict' }) asset!: MediaAsset
  // 删除/替换引用按 sourceKey 定位；归属外键随内容删除级联，均需独立索引。
  @Property({ type: 'text' }) @Index() sourceKey!: string
  @Property({ type: 'text' }) kind!:
    | 'post'
    | 'revision'
    | 'flash'
    | 'site'
    | 'site-revision'
    | 'comment'
    | 'flash-comment'
    | 'moment'
    | 'moment-comment'
    | 'guestbook'
    | 'gallery'
    | 'project'
    | 'subscription'
    | 'link'
    | 'image-prompt'
  @ManyToOne({ entity: () => Post, nullable: true, deleteRule: 'cascade' }) @Index() post?: Post
  @ManyToOne({ entity: () => FlashNote, nullable: true, deleteRule: 'cascade' }) @Index() flashNote?: FlashNote
  @Property({ type: 'integer', nullable: true }) revision?: number
  @ManyToOne({ entity: () => Comment, nullable: true, deleteRule: 'cascade' }) @Index() comment?: Comment
  @ManyToOne({ entity: () => FlashComment, nullable: true, deleteRule: 'cascade' }) @Index() flashComment?: FlashComment
  @ManyToOne({ entity: () => Moment, nullable: true, deleteRule: 'cascade' }) @Index() moment?: Moment
  @ManyToOne({ entity: () => MomentComment, nullable: true, deleteRule: 'cascade' })
  @Index()
  momentComment?: MomentComment
  @ManyToOne({ entity: () => GuestbookMessage, nullable: true, deleteRule: 'cascade' })
  @Index()
  guestbookMessage?: GuestbookMessage
  @ManyToOne({ entity: () => GalleryPhoto, nullable: true, deleteRule: 'cascade' }) @Index() galleryPhoto?: GalleryPhoto
  @ManyToOne({ entity: () => Project, nullable: true, deleteRule: 'cascade' }) @Index() project?: Project
  @ManyToOne({ entity: () => Subscription, nullable: true, deleteRule: 'cascade' }) @Index() subscription?: Subscription
  @ManyToOne({ entity: () => FriendLink, nullable: true, deleteRule: 'cascade' }) @Index() friendLink?: FriendLink
  @ManyToOne({ entity: () => ImagePrompt, nullable: true, deleteRule: 'cascade' }) @Index() imagePrompt?: ImagePrompt
}
