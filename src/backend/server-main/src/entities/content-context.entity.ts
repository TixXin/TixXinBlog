/**
 * @file content-context.entity.ts
 * @description 完整恢复后的数据上下文，阻止旧页面在重新登录后覆盖恢复数据。
 */
import { Entity, PrimaryKey, Property } from '@mikro-orm/core'
@Entity({ tableName: 'content_context' })
export class ContentContext {
  @PrimaryKey({ type: 'text' }) id!: string
  @Property({ type: 'uuid' }) generation!: string
  @Property({ type: 'boolean', default: false }) requireContext: boolean = false
}
