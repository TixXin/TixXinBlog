/**
 * @file content-import-media-plan.ts
 * @description 迁入计划中的受管媒体存在性、字节摘要与完整性核对。
 */
import { createHash } from 'node:crypto'
import type { ContentImportPlan } from '../../entities/content-import.entity'
import type { ContentPackage } from './content-package'
import { managedMediaIds } from '../media/media-references'
import type { MediaStorage } from '../media/media-storage'
import { zh } from '../../common/i18n'

export async function makeMediaImportPlan(
  input: ContentPackage,
  current: ContentPackage,
  requiredValues: unknown[],
  storage: MediaStorage,
  includeSettings: boolean,
  errors: string[],
): Promise<ContentImportPlan['media']> {
  if (includeSettings) requiredValues.push(input.site.avatar)
  const required = new Set(managedMediaIds(requiredValues))
  const incoming = new Map(input.media.map((item) => [item.id, item]))
  const present = new Map(current.media.map((item) => [item.id, item]))
  for (const id of required) {
    if (!incoming.has(id) && !present.has(id)) errors.push(zh('backup.planMediaUnregistered', { id }))
    if (present.get(id)?.deleted || (!present.has(id) && incoming.get(id)?.deleted))
      errors.push(zh('backup.planMediaRecycled', { id }))
  }
  const media: ContentImportPlan['media'] = []
  for (const id of new Set([...incoming.keys(), ...required])) {
    const source = incoming.get(id),
      existing = present.get(id)
    if (!source && !existing) continue
    if (source && existing && source.sha256 !== existing.sha256) {
      errors.push(zh('backup.planMediaIdConflict', { id }))
      continue
    }
    let file: Buffer | null = null
    if (required.has(id) || source?.base64) {
      try {
        file = await storage.readIfExists(`${id}.webp`)
      } catch {
        errors.push(zh('backup.planMediaUnreadable', { id }))
      }
      if (file && createHash('sha256').update(file).digest('hex') !== (existing?.sha256 ?? source?.sha256))
        errors.push(zh('backup.planMediaIntegrity', { id }))
      if (!file && !source?.base64) errors.push(zh('backup.planMediaFileMissing', { id }))
    }
    const skip = !existing && !source?.base64 && !required.has(id)
    media.push({ id, create: !existing && !skip, writeFile: !file && !!source?.base64, skip })
  }
  return media
}
