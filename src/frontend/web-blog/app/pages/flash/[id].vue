<!--
  @file [id].vue
  @description 闪念单条详情页：独立 URL、OG 卡、上下条导航，展示博主公开闪念
  @author TixXin
  @since 2026-04-17
-->

<template>
  <div class="main-inner flash-detail-page">
    <div class="main-content__header flash-detail-header">
      <NuxtLink to="/flash" class="back-btn" aria-label="返回闪念">
        <Icon name="lucide:arrow-left" size="16" />
        <span>返回闪念</span>
      </NuxtLink>
    </div>

    <CommonCustomScrollbar class="flash-detail-body" viewport-class="flash-detail-viewport" primary>
      <div class="flash-detail-content">
        <CommonStateBlock
          v-if="loadFinished && !note"
          icon="lucide:search-x"
          title="闪念不存在"
          description="这条闪念可能已被删除或链接有误"
        >
          <NuxtLink to="/flash" class="back-link">
            <Icon name="lucide:arrow-left" size="14" />
            返回闪念
          </NuxtLink>
        </CommonStateBlock>

        <template v-else-if="note">
          <article class="flash-detail-card">
            <FlashNoteCard :note="note" read-only />
          </article>

          <p class="flash-detail-hint">
            <Icon name="lucide:info" size="12" />
            详情页为只读视图，点赞 / 评论请
            <NuxtLink to="/flash" class="flash-detail-hint__link">回到主页</NuxtLink>
          </p>

          <nav class="flash-detail-nav" aria-label="闪念导航">
            <NuxtLink
              v-if="prevNote"
              :to="`/flash/${prevNote.id}`"
              class="flash-detail-nav__item flash-detail-nav__item--prev"
            >
              <Icon name="lucide:chevron-left" size="18" class="flash-detail-nav__arrow" />
              <div class="flash-detail-nav__text">
                <span class="flash-detail-nav__label">上一条</span>
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
                <span class="flash-detail-nav__label">下一条</span>
                <span class="flash-detail-nav__title">{{ truncate(nextNote.content, 40) }}</span>
              </div>
              <Icon name="lucide:chevron-right" size="18" class="flash-detail-nav__arrow" />
            </NuxtLink>
            <span v-else class="flash-detail-nav__placeholder" />
          </nav>
        </template>

        <div v-else class="flash-detail-loading">
          <Icon name="lucide:loader-2" size="20" class="flash-detail-loading__icon" />
          <span>加载中...</span>
        </div>
      </div>
    </CommonCustomScrollbar>
  </div>
</template>

<script setup lang="ts">
import type { FlashNote } from '~/features/flash/types'

const route = useRoute()

const id = computed(() => String(route.params.id ?? ''))

const ownerNotes = ref<FlashNote[]>([])
const loadFinished = ref(false)

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

function truncate(s: string, n: number) {
  const t = s.replace(/\s+/g, ' ')
  return t.length > n ? `${t.slice(0, n)}…` : t
}

// 客户端挂载后从 LocalStorage 拉 owner 列表（server 端 localStorage 不可用）
const { fetchOwnerNotes } = useFlashNotes()
onMounted(async () => {
  try {
    ownerNotes.value = await fetchOwnerNotes()
  } finally {
    loadFinished.value = true
  }
})

// SEO：content 前 120 字摘要，首图（images 若有）作为 ogImage
const excerpt = computed(() => {
  if (!note.value) return '闪念不存在或已被删除'
  return note.value.content.replace(/\s+/g, ' ').slice(0, 120)
})

const pageTitle = computed(() => {
  if (!note.value) return '闪念不存在'
  const first = note.value.content.replace(/\s+/g, ' ').slice(0, 36)
  return `${first}${note.value.content.length > 36 ? '…' : ''}`
})

useSeoMeta({
  title: () => pageTitle.value,
  description: () => excerpt.value,
  ogTitle: () => `${pageTitle.value} - TixXin 闪念`,
  ogDescription: () => excerpt.value,
  ogType: 'article',
  twitterCard: 'summary',
  twitterTitle: () => `${pageTitle.value} - TixXin 闪念`,
  twitterDescription: () => excerpt.value,
})

useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: computed(() =>
        note.value
          ? JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'SocialMediaPosting',
              headline: pageTitle.value,
              articleBody: note.value.content,
              datePublished: note.value.createdAt,
              dateModified: note.value.updatedAt,
              keywords: note.value.tags.join(', '),
              author: { '@type': 'Person', name: 'TixXin' },
              publisher: { '@type': 'Organization', name: 'TixXin Blog' },
            })
          : '',
      ),
    },
  ],
})
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

.flash-detail-hint__link {
  color: var(--accent);
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}

.flash-detail-nav {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
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
  color: var(--accent);
  text-decoration: none;
  font-size: 0.875rem;

  &:hover {
    text-decoration: underline;
  }
}
</style>
