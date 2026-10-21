/**
 * @file maintenance.service.ts
 * @description 系统维护与诊断服务：数据库连通性、Schema 漂移、媒体完整性核验
 */
import { Injectable } from '@nestjs/common'
import { EntityManager, MikroORM } from '@mikro-orm/postgresql'
import { createHash } from 'node:crypto'
import { MediaStorage } from '../media/media-storage'
import { MediaAsset } from '../../entities/media-asset.entity'
import { ContentContext } from '../../entities/content-context.entity'
import { translate, type ApiLocale } from '../../common/i18n'

export interface MaintenanceProblem {
  id: string
  deleted: boolean
  reason: string
}

@Injectable()
export class MaintenanceService {
  constructor(
    private readonly em: EntityManager,
    private readonly orm: MikroORM,
    private readonly storage: MediaStorage,
  ) {}

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
        nodeSupported: Number(process.versions.node.split('.')[0]) === 25,
        environment: process.env.NODE_ENV ?? 'development',
      },
    }
  }

  async mediaCheck(locale: ApiLocale = 'zh-CN') {
    const assets = await this.em.find(
      MediaAsset,
      {},
      { fields: ['id', 'storageKey', 'sha256', 'byteSize', 'deletedAt'], orderBy: { id: 'asc' } },
    )
    const problems: MaintenanceProblem[] = []
    for (const asset of assets) {
      try {
        const bytes = await this.storage.readIfExists(asset.storageKey)
        if (!bytes)
          problems.push({
            id: asset.id,
            deleted: !!asset.deletedAt,
            reason: translate(locale, 'backup.mediaFileMissing'),
          })
        else if (bytes.length !== asset.byteSize || createHash('sha256').update(bytes).digest('hex') !== asset.sha256)
          problems.push({
            id: asset.id,
            deleted: !!asset.deletedAt,
            reason: translate(locale, 'backup.mediaIntegrityMismatch'),
          })
      } catch {
        problems.push({
          id: asset.id,
          deleted: !!asset.deletedAt,
          reason: translate(locale, 'backup.mediaFileUnreadable'),
        })
      }
    }
    return { checkedAt: new Date().toISOString(), checked: assets.length, problems }
  }
}
