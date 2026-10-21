/** @file useHomeSeo.ts @description 首页与筛选分页的 SEO、规范链接及 Schema.org 结构化数据 */
import type { ShallowRef } from 'vue'
import { readPostListQuery, writePostListQuery } from '~/features/post/listQuery'
import { socialProfiles } from '~/utils/absoluteUrl'

export function useHomeSeo(options: {
  postSummary: ShallowRef<{ tags: Array<{ label: string; slug: string }> } | null>
}) {
  const { postSummary } = options
  const { settings: siteSettings } = useSiteSettings()
  const route = useRoute()
  const siteUrl = useSiteUrl()
  const { t, locale } = useI18n()

  const homeTitle = computed(() => siteSettings.value.seoTitle || siteSettings.value.name)
  const homeDescription = computed(() => siteSettings.value.seoDescription || siteSettings.value.description)
  const homeImage = useDefaultShareImage()

  // 分页与筛选页采用「自引用 canonical + 区分标题」：每页内容不同，不统一指向第一页；
  // canonical 只保留 category/tag/page 三个规范参数，去掉显示模式与跟踪参数。
  const listSeo = computed(() => {
    const { page, tag, category } = readPostListQuery(route.query)
    const tagLabel = postSummary.value?.tags.find((item) => item.slug === tag)?.label ?? tag
    const label = [
      category ? t('article.home.seoCategory', { name: category }) : '',
      tagLabel ? t('article.home.seoTag', { name: tagLabel }) : '',
      page > 1 ? t('article.pagination.page', { page }) : '',
    ]
      .filter(Boolean)
      .join(' · ')
    const search = new URLSearchParams(writePostListQuery({ page, tag, category, mode: 'pagination' })).toString()
    return { label, canonical: `/${search ? `?${search}` : ''}` }
  })

  usePageSeo({
    title: () => listSeo.value.label || homeTitle.value,
    shareTitle: () => (listSeo.value.label ? `${listSeo.value.label} - ${siteSettings.value.name}` : homeTitle.value),
    description: () => homeDescription.value,
    type: 'website',
    canonical: () => listSeo.value.canonical,
  })

  useJsonLd('home', () => ({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${siteUrl}/#website`,
        url: `${siteUrl}/`,
        name: siteSettings.value.name,
        ...(homeDescription.value ? { description: homeDescription.value } : {}),
        inLanguage: locale.value,
        publisher: { '@id': `${siteUrl}/#person` },
        potentialAction: {
          '@type': 'SearchAction',
          target: { '@type': 'EntryPoint', urlTemplate: `${siteUrl}/search?q={search_term_string}` },
          'query-input': 'required name=search_term_string',
        },
      },
      {
        '@type': 'Person',
        '@id': `${siteUrl}/#person`,
        name: siteSettings.value.ownerName || siteSettings.value.name,
        url: `${siteUrl}/about`,
        ...(siteSettings.value.ownerTitle ? { jobTitle: siteSettings.value.ownerTitle } : {}),
        ...(homeImage.value ? { image: homeImage.value.url } : {}),
        ...(socialProfiles(siteSettings.value.socials).length
          ? { sameAs: socialProfiles(siteSettings.value.socials) }
          : {}),
      },
    ],
  }))

  return {
    siteSettings,
  }
}
