<!--
  @file [id].vue
  @description 朋友圈单条动态详情页：独立 URL、OG 卡、上一条/下一条导航
  @author TixXin
  @since 2026-04-17
-->

<template>
  <div class="main-inner moment-detail-page">
    <!-- 顶部返回栏 -->
    <div class="main-content__header moment-detail-header">
      <button type="button" class="back-btn" aria-label="返回朋友圈" @click="goBack">
        <Icon name="lucide:arrow-left" size="16" />
        <span>返回朋友圈</span>
      </button>
    </div>

    <CommonCustomScrollbar class="moment-detail-body" viewport-class="moment-detail-viewport" primary>
      <div class="moment-detail-content">
        <!-- 动态不存在 -->
        <CommonStateBlock
          v-if="!moment"
          icon="lucide:search-x"
          title="动态不存在"
          description="这条动态可能已被删除或链接有误"
        >
          <NuxtLink to="/moments" class="back-link">
            <Icon name="lucide:arrow-left" size="14" />
            返回朋友圈
          </NuxtLink>
        </CommonStateBlock>

        <!-- 动态卡片 + 上下条导航 -->
        <template v-else>
          <article class="moment-detail-card">
            <MomentCard :moment="moment" />
          </article>

          <nav class="moment-detail-nav" aria-label="动态导航">
            <NuxtLink
              v-if="prevMoment"
              :to="`/moments/${prevMoment.id}`"
              class="moment-detail-nav__item moment-detail-nav__item--prev"
            >
              <Icon name="lucide:chevron-left" size="18" class="moment-detail-nav__arrow" />
              <div class="moment-detail-nav__text">
                <span class="moment-detail-nav__label">上一条</span>
                <span class="moment-detail-nav__title">{{ truncate(prevMoment.content, 40) }}</span>
              </div>
            </NuxtLink>
            <span v-else class="moment-detail-nav__placeholder" />

            <NuxtLink
              v-if="nextMoment"
              :to="`/moments/${nextMoment.id}`"
              class="moment-detail-nav__item moment-detail-nav__item--next"
            >
              <div class="moment-detail-nav__text">
                <span class="moment-detail-nav__label">下一条</span>
                <span class="moment-detail-nav__title">{{ truncate(nextMoment.content, 40) }}</span>
              </div>
              <Icon name="lucide:chevron-right" size="18" class="moment-detail-nav__arrow" />
            </NuxtLink>
            <span v-else class="moment-detail-nav__placeholder" />
          </nav>
        </template>
      </div>
    </CommonCustomScrollbar>

    <ClientOnly>
      <Teleport to="#right-sidebar-target">
        <SidebarRightSidebar>
          <SidebarMomentAuthorCard :stats="authorStats" />
          <SidebarMomentTopicCard :topics="momentTopics" :active-topic="null" @select="onTopicSelect" />
        </SidebarRightSidebar>
      </Teleport>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import { mockMoments, mockMomentAuthorStats } from '~/features/moment/mock'
import type { MomentTopic } from '~/components/sidebar/MomentTopicCard.vue'

const route = useRoute()
const router = useRouter()

const id = computed(() => route.params.id as string)

// 时间倒序，"上一条"指更早，"下一条"指更晚（更符合博客时间线阅读习惯）
const sortedMoments = computed(() =>
  [...mockMoments].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
)

const currentIndex = computed(() => sortedMoments.value.findIndex((m) => m.id === id.value))
const moment = computed(() => (currentIndex.value >= 0 ? sortedMoments.value[currentIndex.value] : null))

// prev 指更晚（在排序数组中索引更小），next 指更早（索引更大）
const prevMoment = computed(() => {
  if (currentIndex.value <= 0) return null
  return sortedMoments.value[currentIndex.value - 1] ?? null
})
const nextMoment = computed(() => {
  if (currentIndex.value < 0 || currentIndex.value >= sortedMoments.value.length - 1) return null
  return sortedMoments.value[currentIndex.value + 1] ?? null
})

function goBack() {
  if (import.meta.client && window.history.length > 1) {
    router.back()
  } else {
    router.push('/moments')
  }
}

function truncate(str: string, n: number) {
  return str.length > n ? `${str.slice(0, n)}…` : str
}

// OG / SEO：摘要取 content 前 120 字，首图作为 ogImage
const excerpt = computed(() => {
  if (!moment.value) return '动态不存在或已被删除'
  return moment.value.content.replace(/\s+/g, ' ').slice(0, 120)
})

const ogImage = computed(() => moment.value?.images?.[0] ?? '/avatar-photo.webp')

const pageTitle = computed(() => {
  if (!moment.value) return '动态不存在'
  const first = moment.value.content.replace(/\s+/g, ' ').slice(0, 36)
  return `${first}${moment.value.content.length > 36 ? '…' : ''}`
})

useSeoMeta({
  title: () => pageTitle.value,
  description: () => excerpt.value,
  ogTitle: () => `${pageTitle.value} - TixXin 朋友圈`,
  ogDescription: () => excerpt.value,
  ogType: 'article',
  ogImage,
  twitterCard: 'summary_large_image',
  twitterTitle: () => `${pageTitle.value} - TixXin 朋友圈`,
  twitterDescription: () => excerpt.value,
})

// 结构化数据（SocialMediaPosting）
useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: computed(() =>
        moment.value
          ? JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'SocialMediaPosting',
              headline: pageTitle.value,
              articleBody: moment.value.content,
              datePublished: moment.value.date,
              image: moment.value.images ?? [],
              author: { '@type': 'Person', name: 'TixXin' },
              publisher: { '@type': 'Organization', name: 'TixXin Blog' },
            })
          : '',
      ),
    },
  ],
})

// 侧栏数据
const authorStats = mockMomentAuthorStats

const TOPIC_DEFINITIONS: Omit<MomentTopic, 'count'>[] = [
  { name: '生活日常', icon: 'lucide:sun', color: '#f59e0b', description: '记录每一天的小确幸' },
  { name: '技术分享', icon: 'lucide:code', color: '#3b82f6', description: '代码与灵感的碰撞' },
  { name: '读书笔记', icon: 'lucide:book-open', color: '#8b5cf6', description: '阅读中的思考片段' },
  { name: '摄影记录', icon: 'lucide:camera', color: '#ec4899', description: '用镜头捕捉瞬间' },
  { name: '美食探店', icon: 'lucide:utensils', color: '#ef4444', description: '味蕾的冒险旅程' },
]

const momentTopics = computed<MomentTopic[]>(() =>
  TOPIC_DEFINITIONS.map((t) => ({
    ...t,
    count: mockMoments.filter((m) => m.topics?.includes(t.name)).length,
  })),
)

// 侧栏话题点击 → 跳回列表页（话题筛选由列表页处理，此处暂不透传 query）
function onTopicSelect(_topic: string | null) {
  router.push('/moments')
}
</script>

<style lang="scss" scoped>
.moment-detail-page {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.moment-detail-header {
  display: flex;
  align-items: center;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  border: none;
  background: transparent;
  color: var(--text-soft);
  font-size: 0.875rem;
  border-radius: $radius-sm;
  cursor: pointer;
  transition: $transition-colors;

  &:hover {
    color: var(--text-main);
    background: var(--surface-2);
  }
}

.moment-detail-body {
  flex: 1;
  min-height: 0;
}

:deep(.moment-detail-viewport) {
  padding: 1.5rem 1rem;

  @media (min-width: $breakpoint-md) {
    padding: 2rem;
  }
}

.moment-detail-content {
  max-width: 800px;
  margin: 0 auto;
}

.moment-detail-card {
  background: var(--surface-1);
  border: 1px solid var(--border-soft);
  border-radius: $radius-md;
  padding: 0.5rem 1.25rem;
  margin-bottom: 1.5rem;
}

// 上一条 / 下一条导航
.moment-detail-nav {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.moment-detail-nav__item {
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

.moment-detail-nav__placeholder {
  visibility: hidden;
}

.moment-detail-nav__arrow {
  flex-shrink: 0;
  color: var(--text-soft);
}

.moment-detail-nav__text {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
  flex: 1;
}

.moment-detail-nav__label {
  font-size: 0.75rem;
  color: var(--text-faint);
}

.moment-detail-nav__title {
  font-size: 0.875rem;
  color: var(--text-main);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
