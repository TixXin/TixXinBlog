/**
 * @file refresh-token.entity.ts
 * @description Refresh token 实体：只存 SHA-256 哈希,轮换时撤销旧 token
 * @author TixXin
 * @since 2026-07-20
 */

import { Entity, Index, ManyToOne, PrimaryKey, Property, Unique } from '@mikro-orm/core'
import { AdminUser } from './admin-user.entity'

@Entity({ tableName: 'refresh_token' })
export class RefreshToken {
  @PrimaryKey({ type: 'integer', autoincrement: true })
  id!: number

  @ManyToOne({ entity: () => AdminUser, deleteRule: 'cascade' })
  @Index()
  adminUser!: AdminUser

  /** token 明文的 SHA-256,不落库明文 */
  @Property({ type: 'text' })
  @Unique()
  tokenHash!: string

  @Property({ type: 'text', nullable: true })
  deviceId?: string

  @Property({ type: 'text', nullable: true })
  userAgent?: string

  @Property({ type: 'datetime' })
  expiresAt!: Date

  /** 轮换或登出时写入,非空即失效 */
  @Property({ type: 'datetime', nullable: true })
  revokedAt?: Date

  @Property({ type: 'datetime' })
  createdAt: Date = new Date()
}
