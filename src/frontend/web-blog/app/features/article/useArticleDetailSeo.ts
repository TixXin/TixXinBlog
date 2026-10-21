/** @file useArticleDetailSeo.ts @description 文章详情页的 SEO、Open Graph、Twitter Card 及 Schema.org 结构化数据 */
import type { ComputedRef, Ref } from 'vue'
import type { ArticleDetail } from '~/features/post/types'
import type { SiteSettingsData } from '~/features/site/settings'
import { absoluteUrl } from '~/utils/absoluteUrl'

export function useArticleDetailSeo(options: {
  article: Ref<ArticleDetail> | ComputedRef<ArticleDetail>
  articleExcerpt: Ref<string>
  canonicalUrl: ComputedRef<string>
  publicSite: string
  siteSettings: Ref<SiteSettingsData>
}) {
  const { article, articleExcerpt, canonicalUrl, publicSite, siteSettings } = options
  const { t, locale } = useI18n()

  const seoDescription = computed(() => article.value.seoDescription || articleExcerpt.value)

  usePageSeo({
    title: () => article.value.seoTitle || article.value.title,
    description: () => seoDescription.value,
    type: 'article',
    canonical: () => canonicalUrl.value,
    image: () => article.value.cover,
    imageAlt: () => article.value.coverAlt || article.value.title,
    // 可索引时不写 robots，保留模块默认的 max-image-preview 等指令
    robots: () => (article.value.seoNoindex ? 'noindex, follow' : undefined),
  })

  const articleTags = computed(() => (article.value.tags ?? []).map((tag) => tag.label))

  useSeoMeta({
    articlePublishedTime: () => article.value.date || undefined,
    articleModifiedTime: () => article.value.updatedAt || undefined,
    articleSection: () => article.value.category || undefined,
    articleTag: () => (articleTags.value.length ? articleTags.value : undefined),
  })

  useHead({
    meta: () => (articleTags.value.length ? [{ name: 'keywords', content: articleTags.value.join(',') }] : []),
  })

  const articleImage = computed(() => absoluteUrl(article.value.cover, publicSite))
  const authorName = computed(() => siteSettings.value.ownerName || siteSettings.value.name)

  useJsonLd('article', () => ({
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: article.value.seoTitle || article.value.title,
    description: seoDescription.value,
    url: canonicalUrl.value,
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonicalUrl.value },
    ...(articleImage.value ? { image: [articleImage.value] } : {}),
    datePublished: article.value.date,
    ...(article.value.updatedAt ? { dateModified: article.value.updatedAt } : {}),
    ...(articleTags.value.length ? { keywords: articleTags.value.join(',') } : {}),
    ...(article.value.category ? { articleSection: article.value.category } : {}),
    inLanguage: locale.value,
    author: { '@type': 'Person', name: authorName.value, url: publicSite + '/about' },
    publisher: { '@type': 'Person', name: authorName.value, url: publicSite + '/' },
  }))

  useJsonLd('breadcrumb', () => ({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: t('article.detail.breadcrumbHome'), item: publicSite + '/' },
      ...(article.value.category
        ? [
            {
              '@type': 'ListItem',
              position: 2,
              name: article.value.category,
              item: `${publicSite}/?category=${encodeURIComponent(article.value.category)}`,
            },
          ]
        : []),
      {
        '@type': 'ListItem',
        position: article.value.category ? 3 : 2,
        name: article.value.title,
        item: canonicalUrl.value,
      },
    ],
  }))

  return {
    seoDescription,
  }
}
