/**
 * @file post-tag.entity.ts
 * @description 文章标签实体，label/color 对齐前端 PostTag 类型
 * @author TixXin
 * @since 2026-07-20
 */

import { Entity, PrimaryKey, Property, Unique } from '@mikro-orm/core'

/** 标签颜色枚举，对齐前端 features/post/types.ts 的 PostTag.color */
export const POST_TAG_COLORS = ['emerald', 'rose', 'sky', 'orange', 'blue', 'amber'] as const
export type PostTagColor = (typeof POST_TAG_COLORS)[number]

@Entity({ tableName: 'post_tag' })
export class PostTag {
  @PrimaryKey({ type: 'integer', autoincrement: true })
  id!: number

  @Property({ type: 'text' })
  @Unique()
  label!: string

  @Property({ type: 'text' })
  @Unique()
  slug!: string

  @Property({ type: 'text', default: 'blue' })
  color: PostTagColor = 'blue'

  /** 冗余计数，避免列表页 join 聚合；由写路径维护 */
  @Property({ type: 'integer', default: 0 })
  count: number = 0
}
