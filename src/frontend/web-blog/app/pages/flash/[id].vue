<!--
  @file [id].vue
  @description 闪念单条详情页：独立 URL、OG 卡、上下条导航，展示博主公开闪念
  @author TixXin
  @since 2026-04-17
-->

<template>
  <CommonPageFrame class="main-inner flash-detail-page" header-key="flash-return">
    <template #header>
      <div class="main-content__header flash-detail-header">
        <h1 class="sr-only">{{ pageTitle }}</h1>
        <NuxtLink to="/flash" class="back-btn" :aria-label="$t('flash-moment.flashDetail.back')">
          <Icon name="lucide:arrow-left" size="16" />
          <span>{{ $t('flash-moment.flashDetail.back') }}</span>
        </NuxtLink>
      </div>
    </template>
    <template #default>
      <CommonCustomScrollbar class="flash-detail-body" viewport-class="flash-detail-viewport" primary>
        <div class="flash-detail-content">
          <CommonRequestFeedback
            v-if="loadError"
            :pending="detailResult.pending.value"
            :title="$t('flash-moment.flashDetail.loadFailed')"
            :description="$t('flash-moment.flashDetail.loadFailedDesc')"
            @retry="refreshNotes()"
          />
          <CommonStateBlock
            v-else-if="loadFinished && !note"
            icon="lucide:search-x"
            :title="$t('flash-moment.flashDetail.notFound')"
            :description="$t('flash-moment.flashDetail.notFoundDesc')"
          >
            <NuxtLink to="/flash" class="back-link">
              <Icon name="lucide:arrow-left" size="14" />
              {{ $t('flash-moment.flashDetail.back') }}
            </NuxtLink>
          </CommonStateBlock>

          <template v-else-if="note">
            <article class="flash-detail-card">
              <FlashNoteCard :note="note" read-only :interactive="false" />
            </article>

            <p class="flash-detail-hint">
              <Icon name="lucide:info" size="12" class="flash-detail-hint__icon" />
              <i18n-t keypath="flash-moment.flashDetail.readOnlyHint" tag="span" scope="global">
                <template #link
                  ><NuxtLink to="/flash" class="flash-detail-hint__link">{{
                    $t('flash-moment.flashDetail.readOnlyHintLink')
                  }}</NuxtLink></template
                >
              </i18n-t>
            </p>

            <nav class="flash-detail-nav" :aria-label="$t('flash-moment.flashDetail.nav')">
              <NuxtLink
                v-if="prevNote"
                :to="`/flash/${prevNote.id}`"
                class="flash-detail-nav__item flash-detail-nav__item--prev"
              >
                <Icon name="lucide:chevron-left" size="18" class="flash-detail-nav__arrow" />
                <div class="flash-detail-nav__text">
                  <span class="flash-detail-nav__label">{{ $t('flash-moment.flashDetail.prev') }}</span>
                  <span class="flash-detail-nav__title">{{ truncate(prevNote.content, 40) }}</span>
                </div>
              </NuxtLink>
              <span v-else class="flash-detail-nav__placeholder" />

              <NuxtLink
                v-if="nextNote"
                :to="`/flash/${nextNote.id}`"
                class="flash-detail-nav__item flash-detail-nav__item--next"
              >
                <div class="flash-detail-nav__text">
                  <span class="flash-detail-nav__label">{{ $t('flash-moment.flashDetail.next') }}</span>
                  <span class="flash-detail-nav__title">{{ truncate(nextNote.content, 40) }}</span>
                </div>
                <Icon name="lucide:chevron-right" size="18" class="flash-detail-nav__arrow" />
              </NuxtLink>
              <span v-else class="flash-detail-nav__placeholder" />
            </nav>
          </template>

          <div v-else class="flash-detail-loading">
            <Icon name="lucide:loader-2" size="20" class="flash-detail-loading__icon" />
            <span>{{ $t('flash-moment.flashDetail.loading') }}</span>
          </div>
        </div>
      </CommonCustomScrollbar>
    </template>
    <template #overlays> </template>
  </CommonPageFrame>
</template>

<script setup lang="ts">
import { absoluteUrl } from '~/utils/absoluteUrl'
import type { FlashNote } from '~/features/flash/types'
definePageMeta({ rightSidebar: false })

const route = useRoute()
const { t } = useI18n()
// 结构化数据里的作者与发布方取自博主维护的站点资料，不在页面内写死
const { settings: siteSettings } = useSiteSettings()

const id = computed(() => String(route.params.id ?? ''))

const localOnly = useRuntimeConfig().public.useMockRepo !== false
const { fetchOwnerNotes } = useFlashNotes()
const detailResult = await useAsyncData<FlashNote[]>(`flash-public-${id.value}`, fetchOwnerNotes, {
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

function truncate(s: string, n: number) {
  const t = s.replace(/\s+/g, ' ')
  return t.length > n ? `${t.slice(0, n)}…` : t
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
  shareTitle: () => t('flash-moment.flashDetail.shareTitle', { title: pageTitle.value, site: siteSettings.value.name }),
  type: 'article',
  canonical: () => flashUrl.value,
  // 无配图时交回全局默认分享图（小卡片）
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
</script>

<style lang="scss" scoped>
.flash-detail-page {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.flash-detail-header {
  display: flex;
  align-items: center;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  color: var(--text-soft);
  font-size: 0.875rem;
  border-radius: $radius-sm;
  text-decoration: none;
  transition: $transition-colors;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    color: var(--text-main);
    background: var(--surface-2);
  }
}

.flash-detail-body {
  flex: 1;
  min-height: 0;
}

:deep(.flash-detail-viewport) {
  padding: 1.5rem 1rem;

  @media (min-width: $breakpoint-md) {
    padding: 2rem;
  }
}

.flash-detail-content {
  max-width: 720px;
  margin: 0 auto;
}

.flash-detail-card {
  margin-bottom: 0.5rem;
}

.flash-detail-hint {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  margin: 0 0 1.25rem;
  padding: 0.5rem 0.75rem;
  font-size: 0.75rem;
  color: var(--text-soft);
  background: var(--surface-2);
  border-radius: $radius-sm;
}

.flash-detail-hint__icon {
  flex-shrink: 0;
}

.flash-detail-hint__link {
  margin-left: 0.25rem;
  color: var(--accent-text);
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}

.flash-detail-nav {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;

  // 手机端两列太窄，标题只剩几个字；改为单列并去掉占位
  @media (max-width: $breakpoint-sm) {
    grid-template-columns: minmax(0, 1fr);
  }
}

.flash-detail-nav__item {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.875rem 1rem;
  background: var(--surface-2);
  border: 1px solid var(--border-soft);
  border-radius: $radius-md;
  color: inherit;
  text-decoration: none;
  transition: $transition-normal;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
  min-width: 0;

  &:hover {
    background: var(--surface-3);
    border-color: var(--border);
    transform: translateY(-1px);
  }

  &--next {
    justify-content: flex-end;
    text-align: right;
  }
}

.flash-detail-nav__placeholder {
  visibility: hidden;

  @media (max-width: $breakpoint-sm) {
    display: none;
  }
}

.flash-detail-nav__arrow {
  flex-shrink: 0;
  color: var(--text-soft);
}

.flash-detail-nav__text {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
  flex: 1;
}

.flash-detail-nav__label {
  font-size: 0.75rem;
  color: var(--text-faint);
}

.flash-detail-nav__title {
  font-size: 0.875rem;
  color: var(--text-main);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.flash-detail-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 3rem 0;
  color: var(--text-faint);
  font-size: 0.875rem;
}

.flash-detail-loading__icon {
  animation: flash-spin 1s linear infinite;
  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
}

@keyframes flash-spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  margin-top: 1rem;
  color: var(--accent-text);
  text-decoration: none;
  font-size: 0.875rem;

  &:hover {
    text-decoration: underline;
  }
}
</style>
