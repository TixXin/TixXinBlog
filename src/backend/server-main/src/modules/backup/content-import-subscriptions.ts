/** @file content-import-subscriptions.ts @description 平台订阅迁入保留价格事实，只创建草稿、重建图标引用，不继承提交身份。 */
import type { EntityManager } from '@mikro-orm/postgresql'
import { ConflictException } from '@nestjs/common'
import { Subscription } from '../../entities/subscription.entity'
import { MediaAsset } from '../../entities/media-asset.entity'
import type { ContentImportPlan, ContentImportResult } from '../../entities/content-import.entity'
import type { ContentPackage } from './content-package'
import { msg } from '../../common/i18n'
import { mediaUrl, synchronizeMediaReferences } from '../media/media-references'

export async function importSubscriptions(
  em: EntityManager,
  payload: ContentPackage,
  plan: ContentImportPlan,
  result: ContentImportResult,
) {
  for (const source of payload.subscriptions ?? []) {
    const target = plan.subscriptions?.find((item) => item.sourceId === source.sourceId)
    if (!target) throw new ConflictException(msg('backup.subscriptionPlanMissing'))
    if (target.skip) continue
    const { iconMediaId, ...values } = source.values
    const subscription = em.create(Subscription, {
      ...values,
      priceHistory: structuredClone(values.priceHistory),
      status: 'draft',
      iconMedia: iconMediaId ? em.getReference(MediaAsset, iconMediaId) : null,
      createdAt: new Date(source.createdAt),
      publishedAt: source.publishedAt ? new Date(source.publishedAt) : null,
    })
    await em.flush()
    await synchronizeMediaReferences(
      em,
      `subscription:${subscription.id}`,
      'subscription',
      iconMediaId ? [mediaUrl(iconMediaId)] : [],
      { subscription },
    )
    result.subscriptions ??= []
    result.subscriptions.push({ sourceId: source.sourceId, id: subscription.id })
  }
}
