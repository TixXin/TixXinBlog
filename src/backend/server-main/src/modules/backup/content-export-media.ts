/**
 * @file content-export-media.ts
 * @description 导出受管媒体的字节读取、Base64 编码与完整性校验。
 */
import { PayloadTooLargeException, ServiceUnavailableException } from '@nestjs/common'
import { createHash } from 'node:crypto'
import type { MediaStorage } from '../media/media-storage'
import type { ContentPackage } from './content-package'
import { MAX_PACKAGE_BYTES } from './content-package'
import { msg } from '../../common/i18n'

export async function packExportMedia(
  storage: MediaStorage,
  media: ContentPackage['media'],
  baseSize: number,
): Promise<void> {
  let size = baseSize
  for (const asset of media) {
    size += Math.ceil(asset.byteSize / 3) * 4 + 16
    if (size > MAX_PACKAGE_BYTES) throw new PayloadTooLargeException(msg('backup.packageWithMediaOver50mb'))
    let bytes: Buffer
    try {
      bytes = await storage.get(`${asset.id}.webp`)
    } catch {
      throw new ServiceUnavailableException(msg('backup.exportMediaUnreadable', { id: asset.id }))
    }
    if (bytes.length !== asset.byteSize || createHash('sha256').update(bytes).digest('hex') !== asset.sha256)
      throw new ServiceUnavailableException(msg('backup.exportMediaIntegrity', { id: asset.id }))
    asset.base64 = bytes.toString('base64')
  }
}
