/**
 * @file admin-session.entity.ts
 * @description 跨刷新轮换的稳定会话身份；访问令牌与刷新令牌都受撤销状态约束。
 */
import { Entity, Index, ManyToOne, OptionalProps, PrimaryKey, Property } from '@mikro-orm/core'
import { randomUUID } from 'node:crypto'
import { AdminUser } from './admin-user.entity'
@Entity({ tableName: 'admin_session' })
export class AdminSession {
  [OptionalProps]?: 'id' | 'createdAt'
  @PrimaryKey({ type: 'uuid' }) id: string = randomUUID()
  @ManyToOne({ entity: () => AdminUser, deleteRule: 'cascade' }) @Index() adminUser!: AdminUser
  @Property({ type: 'text' }) deviceLabel!: string
  @Property({ type: 'datetime', nullable: true }) loginAt?: Date
  @Property({ type: 'datetime' }) createdAt: Date = new Date()
  @Property({ type: 'datetime' }) lastRefreshedAt!: Date
  @Property({ type: 'datetime' }) @Index() expiresAt!: Date
  @Property({ type: 'datetime', nullable: true }) revokedAt?: Date
}
