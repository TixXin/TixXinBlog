/**
 * @file taxonomy-alias.entity.ts
 * @description 目录历史名称映射，阻止旧编辑页和修订恢复重新创建废弃名称。
 */
import { Entity, PrimaryKey, Property, Unique } from '@mikro-orm/core'

@Entity({ tableName: 'taxonomy_alias' })
@Unique({ properties: ['kind', 'alias'] })
export class TaxonomyAlias {
  @PrimaryKey({ type: 'integer', autoincrement: true }) id!: number
  @Property({ type: 'text' }) kind!: 'folders' | 'tags'
  @Property({ type: 'text' }) alias!: string
  @Property({ type: 'text' }) target!: string
}
