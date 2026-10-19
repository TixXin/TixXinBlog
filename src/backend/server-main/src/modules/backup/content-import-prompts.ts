/** @file content-import-prompts.ts @description 提示词迁入只创建草稿并重建受管图片引用，不继承原请求标识。 */
import type { EntityManager } from '@mikro-orm/postgresql'
import { ConflictException } from '@nestjs/common'
import { ImagePrompt } from '../../entities/image-prompt.entity'
import { MediaAsset } from '../../entities/media-asset.entity'
import type { ContentImportPlan, ContentImportResult } from '../../entities/content-import.entity'
import type { ContentPackage } from './content-package'
import { msg } from '../../common/i18n'
import { mediaUrl, synchronizeMediaReferences } from '../media/media-references'

export async function importPrompts(
  em: EntityManager,
  payload: ContentPackage,
  plan: ContentImportPlan,
  result: ContentImportResult,
) {
  for (const source of payload.prompts ?? []) {
    const target = plan.prompts?.find((prompt) => prompt.sourceId === source.sourceId)
    if (!target) throw new ConflictException(msg('backup.promptPlanMissing'))
    if (target.skip) continue
    const { mediaId, ...values } = source.values
    const prompt = em.create(ImagePrompt, {
      ...values,
      status: 'draft',
      media: mediaId ? em.getReference(MediaAsset, mediaId) : null,
      createdAt: new Date(source.createdAt),
      publishedAt: source.publishedAt ? new Date(source.publishedAt) : null,
    })
    await em.flush()
    await synchronizeMediaReferences(
      em,
      `image-prompt:${prompt.id}`,
      'image-prompt',
      mediaId ? [mediaUrl(mediaId)] : [],
      {
        imagePrompt: prompt,
      },
    )
    result.prompts ??= []
    result.prompts.push({ sourceId: source.sourceId, id: prompt.id })
  }
}
