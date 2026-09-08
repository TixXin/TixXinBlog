/**
 * @file maintenance.controller.ts
 * @description 管理员运行诊断与媒体完整性核验，不向公开探针暴露内部连接配置。
 */
import { Controller, Get, Post, UseGuards } from '@nestjs/common'
import { EntityManager, MikroORM } from '@mikro-orm/postgresql'
import { createHash } from 'node:crypto'
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard'
import { MediaStorage } from '../media/media-storage'
import { MediaAsset } from '../../entities/media-asset.entity'
import { ContentContext } from '../../entities/content-context.entity'
@Controller('admin/maintenance')
@UseGuards(AdminAuthGuard)
export class MaintenanceController {
  constructor(
    private readonly em: EntityManager,
    private readonly orm: MikroORM,
    private readonly storage: MediaStorage,
  ) {}
  @Get('diagnostics')
  async diagnostics() {
    await this.em.execute('select 1')
    const [migrations, storage, context, media] = await Promise.all([
      this.orm.getMigrator().getPendingMigrations(),
      this.storage.probe(),
      this.em.findOneOrFail(ContentContext, { id: 'default' }),
      this.em.count(MediaAsset, {}),
    ])
    const drift = (await this.orm.schema.getUpdateSchemaSQL({ wrap: false })).trim().length > 0
    return {
      checkedAt: new Date().toISOString(),
      databaseReachable: true,
      pendingMigrations: migrations.length,
      schemaDrift: drift,
      storage,
      mediaRecords: media,
      contentContextRequired: context.requireContext,
      runtime: {
        node: process.version,
        nodeSupported: Number(process.versions.node.split('.')[0]) === 24,
        environment: process.env.NODE_ENV ?? 'development',
      },
    }
  }
  @Post('media-check')
  async mediaCheck() {
    const assets = await this.em.find(
      MediaAsset,
      {},
      { fields: ['id', 'storageKey', 'sha256', 'byteSize', 'deletedAt'], orderBy: { id: 'asc' } },
    )
    const problems: { id: string; deleted: boolean; reason: string }[] = []
    for (const asset of assets) {
      try {
        const bytes = await this.storage.readIfExists(asset.storageKey)
        if (!bytes) problems.push({ id: asset.id, deleted: !!asset.deletedAt, reason: '文件缺失' })
        else if (bytes.length !== asset.byteSize || createHash('sha256').update(bytes).digest('hex') !== asset.sha256)
          problems.push({ id: asset.id, deleted: !!asset.deletedAt, reason: '完整性不符' })
      } catch {
        problems.push({ id: asset.id, deleted: !!asset.deletedAt, reason: '文件不可读' })
      }
    }
    return { checkedAt: new Date().toISOString(), checked: assets.length, problems }
  }
}
