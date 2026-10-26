/**
 * @file content-export.service.ts
 * @description 在一致快照中导出当前内容与公开配置，可选择包含受管媒体；不复制账号和访客凭据。
 */
import { EntityManager } from '@mikro-orm/postgresql'
import { IsolationLevel } from '@mikro-orm/core'
import { Injectable, PayloadTooLargeException } from '@nestjs/common'
import { msg } from '../../common/i18n'
import { MediaStorage } from '../media/media-storage'
import { MAX_PACKAGE_BYTES } from './content-package'
import type { ContentPackage } from './content-package'
import { buildExportPackage } from './content-export-transform'
import { packExportMedia } from './content-export-media'
import { assertExportCounts, assertExportRows, loadExportRows, loadExportTaxonomy } from './content-export-load'

@Injectable()
export class ContentExportService {
  constructor(
    private readonly em: EntityManager,
    private readonly storage: MediaStorage,
  ) {}

  async snapshot(mediaIncluded: boolean, manager?: EntityManager): Promise<ContentPackage> {
    const capture = (em: EntityManager) => this.capture(em, mediaIncluded)
    return manager
      ? capture(manager)
      : this.em.transactional(capture, { isolationLevel: IsolationLevel.REPEATABLE_READ })
  }

  private async capture(em: EntityManager, mediaIncluded: boolean): Promise<ContentPackage> {
    await assertExportCounts(em)
    const rows = await loadExportRows(em)
    assertExportRows(rows, mediaIncluded)
    const taxonomy = await loadExportTaxonomy(em)
    const result = buildExportPackage({ ...rows, ...taxonomy }, mediaIncluded)

    const size = Buffer.byteLength(JSON.stringify(result))
    if (size > MAX_PACKAGE_BYTES) throw new PayloadTooLargeException(msg('backup.packageOver50mb'))

    if (mediaIncluded) {
      await packExportMedia(this.storage, result.media, size)
    }
    return result
  }
}
