/** @file friend-link-application.entity.ts @description 访客提交的友链申请，属于审核流程数据，不进入内容包；通过后另建友链草稿 */
import { Entity, Index, OptionalProps, PrimaryKey, Property } from '@mikro-orm/core'
export const LINK_APPLICATION_STATUSES = ['pending', 'approved', 'rejected'] as const
export type LinkApplicationStatus = (typeof LINK_APPLICATION_STATUSES)[number]
@Entity({ tableName: 'friend_link_application' })
@Index({ name: 'friend_link_application_status_created_idx', properties: ['status', 'createdAt'] })
@Index({
  name: 'friend_link_application_pending_url_unique',
  expression: `create unique index "friend_link_application_pending_url_unique" on "friend_link_application" ("url") where "status" = 'pending'`,
})
export class FriendLinkApplication {
  [OptionalProps]?: 'description' | 'contact' | 'message' | 'status' | 'createdAt' | 'updatedAt'
  /** 申请编号，通过时作为友链草稿的 requestId */
  @PrimaryKey({ type: 'uuid' }) id!: string
  @Property({ type: 'text' }) name!: string
  @Property({ type: 'text' }) url!: string
  @Property({ type: 'text', default: '' }) description: string = ''
  /** 选填联系方式，只给博主查看，不做任何投递 */
  @Property({ type: 'text', nullable: true }) contact?: string | null
  @Property({ type: 'text', default: '' }) message: string = ''
  @Property({ type: 'text', default: 'pending' }) status: LinkApplicationStatus = 'pending'
  @Property({ type: 'datetime', nullable: true }) handledAt?: Date | null
  /** 通过后生成的友链编号，仅作记录；友链删除不回写申请 */
  @Property({ type: 'integer', nullable: true }) createdLinkId?: number | null
  @Property({ type: 'datetime' }) createdAt: Date = new Date()
  @Property({ type: 'datetime', onUpdate: () => new Date() }) updatedAt: Date = new Date()
}
