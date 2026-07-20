/**
 * @file admin-user.entity.ts
 * @description 管理员账号实体，密码使用 argon2id 哈希存储
 * @author TixXin
 * @since 2026-07-20
 */

import { Entity, PrimaryKey, Property, Unique } from '@mikro-orm/core'
import { randomUUID } from 'node:crypto'

@Entity({ tableName: 'admin_user' })
export class AdminUser {
  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID()

  @Property({ type: 'text' })
  @Unique()
  username!: string

  /** argon2id 哈希（m=65536, t=3, p=4，见 development.md §14） */
  @Property({ type: 'text' })
  passwordHash!: string

  @Property({ type: 'datetime' })
  createdAt: Date = new Date()

  @Property({ type: 'datetime', nullable: true })
  lastLoginAt?: Date
}
