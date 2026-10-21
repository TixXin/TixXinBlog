/**
 * @file useFlashDetail.ts
 * @description 闪念单条详情页数据加载、上下条计算与 SEO/结构化数据编排
 * @author TixXin
 * @since 2026-10-21
 */

import { absoluteUrl } from '~/utils/absoluteUrl'
import type { FlashNote } from '~/features/flash/types'

export function useFlashDetail() {
  const route = useRoute()
  const { t } = useI18n()
  const { settings: siteSettings } = useSiteSettings()

  const id = computed(() => String(route.params.id ?? ''))
  const localOnly = useRuntimeConfig().public.useMockRepo !== false
  const { fetchOwnerNotes } = useFlashNotes()

  const detailResult = useAsyncData<FlashNote[]>(`flash-public-${id.value}`, fetchOwnerNotes, {
    server: !localOnly,
  })
  const ownerNotes = computed(() => detailResult.data.value ?? [])
  const loadError = detailResult.error
  const refreshNotes = detailResult.refresh
  const loadFinished = computed(() => detailResult.status.value === 'success' || detailResult.status.value === 'error')

  // 按 createdAt 倒序排序（与主页一致）
  const sortedNotes = computed(() =>
    [...ownerNotes.value].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
  )

  const currentIndex = computed(() => sortedNotes.value.findIndex((n) => n.id === id.value))
  const note = computed<FlashNote | null>(() =>
    currentIndex.value >= 0 ? (sortedNotes.value[currentIndex.value] ?? null) : null,
  )

  // prev 指更晚（索引更小），next 指更早（索引更大）
  const prevNote = computed(() => {
    if (currentIndex.value <= 0) return null
    return sortedNotes.value[currentIndex.value - 1] ?? null
  })
  const nextNote = computed(() => {
    if (currentIndex.value < 0 || currentIndex.value >= sortedNotes.value.length - 1) return null
    return sortedNotes.value[currentIndex.value + 1] ?? null
  })

  // 本机仓库只能由浏览器确认；真实HTTP模式在SSR阶段区分服务失败与资源缺失。
  function assertReady() {
    if (!localOnly) {
      if (loadError.value)
        throw createError({
          statusCode: 502,
          statusMessage: 'Bad Gateway',
          data: { title: t('flash-moment.flashDetail.loadFailed') },
          fatal: true,
        })
      if (!note.value)
        throw createError({
          statusCode: 404,
          statusMessage: 'Not Found',
          data: { title: t('flash-moment.flashDetail.notFound') },
          fatal: true,
        })
    }
  }

  // SEO：content 前 120 字摘要，首图（images 若有）作为 ogImage
  const excerpt = computed(() => {
    if (!note.value)
      return loadFinished.value && !loadError.value
        ? t('flash-moment.flashDetail.seoNotFound')
        : t('flash-moment.flashDetail.seoDescription')
    return note.value.content.replace(/\s+/g, ' ').slice(0, 120)
  })

  const pageTitle = computed(() => {
    if (!note.value)
      return loadFinished.value && !loadError.value
        ? t('flash-moment.flashDetail.notFound')
        : t('flash-moment.flashDetail.seoTitle')
    const first = note.value.content.replace(/\s+/g, ' ').slice(0, 36)
    return `${first}${note.value.content.length > 36 ? '…' : ''}`
  })

  const site = useSiteUrl()
  const flashUrl = computed(() => `${site}/flash/${encodeURIComponent(id.value)}`)
  const flashImage = computed(() => absoluteUrl(note.value?.images?.[0], site))

  usePageSeo({
    title: () => pageTitle.value,
    description: () => excerpt.value,
    shareTitle: () =>
      t('flash-moment.flashDetail.shareTitle', { title: pageTitle.value, site: siteSettings.value.name }),
    type: 'article',
    canonical: () => flashUrl.value,
    image: () => flashImage.value,
    imageAlt: () => note.value?.imageAlts?.[0] || pageTitle.value,
    robots: () => (localOnly ? 'noindex, follow' : undefined),
  })

  useSeoMeta({
    articlePublishedTime: () => note.value?.createdAt,
    articleModifiedTime: () => note.value?.updatedAt,
    articleTag: () => (note.value?.tags.length ? note.value.tags : undefined),
  })

  useJsonLd('flash', () =>
    note.value
      ? {
          '@context': 'https://schema.org',
          '@type': 'SocialMediaPosting',
          headline: pageTitle.value,
          articleBody: note.value.content,
          url: flashUrl.value,
          mainEntityOfPage: flashUrl.value,
          datePublished: note.value.createdAt,
          ...(note.value.updatedAt ? { dateModified: note.value.updatedAt } : {}),
          ...(note.value.tags.length ? { keywords: note.value.tags.join(', ') } : {}),
          ...(flashImage.value ? { image: [flashImage.value] } : {}),
          author: {
            '@type': 'Person',
            name: siteSettings.value.ownerName || siteSettings.value.name,
            url: site + '/about',
          },
        }
      : null,
  )

  return {
    id,
    pageTitle,
    note,
    prevNote,
    nextNote,
    loadError,
    loadFinished,
    detailResult,
    refreshNotes,
    assertReady,
  }
}
