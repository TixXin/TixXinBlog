/**
 * @file post-folder.entity.ts
 * @description 可独立维护的文章专栏目录，保留文章现有 folder 字符串契约。
 */
import { Entity, PrimaryKey, Property, Unique } from '@mikro-orm/core'

@Entity({ tableName: 'post_folder' })
export class PostFolder {
  @PrimaryKey({ type: 'integer', autoincrement: true })
  id!: number

  @Property({ type: 'text' })
  @Unique()
  label!: string
}
