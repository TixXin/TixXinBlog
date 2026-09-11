/** @file operation-control.entity.ts @description 单站点持久运行开关与恢复代次；不保存投递凭据 */
import { Entity, PrimaryKey, Property } from '@mikro-orm/core'
@Entity({ tableName: 'operation_control' })
export class OperationControl {
  @PrimaryKey({ type: 'text' }) id!: string
  @Property({ type: 'uuid' }) generation!: string
  @Property({ type: 'boolean', default: true }) externalPaused = true
  @Property({ type: 'boolean', default: true }) backupPaused = true
  @Property({ type: 'integer', default: 0 }) revision = 0
  @Property({ type: 'text', default: 'not_enabled' }) reason = 'not_enabled'
  @Property({ type: 'datetime', nullable: true }) lastMailAt?: Date
  @Property({ type: 'datetime' }) updatedAt = new Date()
}
