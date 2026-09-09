/** @file development-fixture.entity.ts @description 开发样本内部归属账本；业务记录删除后仍保留标识，避免再次补种复活内容 */
import { Entity, Index, OptionalProps, PrimaryKey, Property } from '@mikro-orm/core'

@Entity({ tableName: 'development_fixture' })
export class DevelopmentFixture {
  [OptionalProps]?: 'createdAt'
  @PrimaryKey({ type: 'text' }) key!: string
  @Property({ type: 'text' }) @Index() dataset!: string
  @Property({ type: 'text' }) kind!: string
  @Property({ type: 'text' }) resourceId!: string
  @Property({ type: 'text' }) snapshotHash!: string
  @Property({ type: 'datetime' }) createdAt: Date = new Date()
}
