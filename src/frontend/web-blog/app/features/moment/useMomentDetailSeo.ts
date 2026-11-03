/**
 * @file useMomentDetailSeo.ts
 * @description 朋友圈详情页 SEO 元数据与 JSON-LD 结构化数据组合函数
 * @author TixXin
 * @since 2026-04-20
 */

import type { MomentItem } from '~/features/moment/types'
import { absoluteUrl } from '~/utils/absoluteUrl'

export interface MomentDetailSeoOptions {
  id: Ref<string>
  moment: Ref<MomentItem | null | undefined>
  ownerName: Ref<string>
}

export function useMomentDetailSeo(options: MomentDetailSeoOptions) {
  const { id, moment, ownerName } = options
  const { t } = useI18n()
  const site = useSiteUrl()
  const { contentCard } = useShareCard()

  function truncate(value: string, max: number) {
    return value.length > max ? value.slice(0, max) + '…' : value
  }

  const excerpt = computed(
    () => moment.value?.content.replace(/\s+/g, ' ').slice(0, 120) ?? t('flash-moment.momentDetail.notFound'),
  )
  const pageTitle = computed(() => truncate(excerpt.value, 36))
  const momentUrl = computed(() => `${site}/moments/${encodeURIComponent(id.value)}`)
  const momentImages = computed(() =>
    (moment.value?.images ?? []).map((image) => absoluteUrl(image, site)).filter((image) => image !== undefined),
  )

  usePageSeo({
    title: () => pageTitle.value,
    description: () => excerpt.value,
    shareTitle: () => t('flash-moment.momentDetail.shareTitle', { title: pageTitle.value, name: ownerName.value }),
    type: 'article',
    canonical: () => momentUrl.value,
    image: () => momentImages.value[0],
    // 没有配图时用朋友圈分享卡片（正文与发布时间）
    fallbackImage: () =>
      moment.value ? contentCard('moment', moment.value.id, [moment.value.content, moment.value.date]) : undefined,
    imageAlt: () => moment.value?.imageAlts?.[0] || pageTitle.value,
  })

  useSeoMeta({
    articlePublishedTime: () => moment.value?.date,
    articleTag: () => (moment.value?.topics?.length ? moment.value.topics : undefined),
  })

  useJsonLd('moment', () =>
    moment.value
      ? {
          '@context': 'https://schema.org',
          '@type': 'SocialMediaPosting',
          headline: pageTitle.value,
          articleBody: moment.value.content,
          url: momentUrl.value,
          mainEntityOfPage: momentUrl.value,
          datePublished: moment.value.date,
          ...(momentImages.value.length ? { image: momentImages.value } : {}),
          ...(moment.value.topics?.length ? { keywords: moment.value.topics.join(', ') } : {}),
          author: { '@type': 'Person', name: ownerName.value, url: site + '/about' },
        }
      : null,
  )

  return {
    pageTitle,
  }
}
