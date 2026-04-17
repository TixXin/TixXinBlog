<!--
  @file [name].vue
  @description 朋友圈话题聚合页：单一话题下的全部动态时间线
  @author TixXin
  @since 2026-04-17
-->

<template>
  <div class="main-inner moment-topic-page">
    <!-- 顶部返回栏 -->
    <div class="main-content__header moment-topic-header">
      <NuxtLink to="/moments" class="back-btn" aria-label="返回朋友圈">
        <Icon name="lucide:arrow-left" size="16" />
        <span>返回朋友圈</span>
      </NuxtLink>
    </div>

    <CommonCustomScrollbar class="moment-topic-body" viewport-class="moment-topic-viewport" primary>
      <div class="moment-topic-content">
        <!-- 话题 Hero -->
        <header v-if="topicMeta" class="moment-topic-hero" :style="heroStyle">
          <div class="moment-topic-hero__icon">
            <Icon :name="topicMeta.icon" size="24" />
          </div>
          <div class="moment-topic-hero__text">
            <h1 class="moment-topic-hero__name">#{{ topicMeta.name }}</h1>
            <p v-if="topicMeta.description" class="moment-topic-hero__desc">{{ topicMeta.description }}</p>
            <p class="moment-topic-hero__count">共 {{ filteredMoments.length }} 条动态</p>
          </div>
        </header>

        <!-- 未知话题降级 -->
        <header v-else class="moment-topic-hero moment-topic-hero--unknown">
          <div class="moment-topic-hero__icon">
            <Icon name="lucide:hash" size="24" />
          </div>
          <div class="moment-topic-hero__text">
            <h1 class="moment-topic-hero__name">#{{ topicName }}</h1>
            <p class="moment-topic-hero__count">共 {{ filteredMoments.length }} 条动态</p>
          </div>
        </header>

        <MomentList :moments="filteredMoments" :selected-topic="null" :selected-date="null" />
      </div>
    </CommonCustomScrollbar>

    <ClientOnly>
      <Teleport to="#right-sidebar-target">
        <SidebarRightSidebar>
          <SidebarMomentAuthorCard :stats="authorStats" />
          <SidebarMomentTopicCard :topics="momentTopics" :active-topic="topicName" @select="onTopicSelect" />
        </SidebarRightSidebar>
      </Teleport>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import { mockMomentAuthorStats } from '~/features/moment/mock'
import { MOMENT_TOPIC_DEFINITIONS, findMomentTopic } from '~/features/moment/topics'
import type { MomentTopic } from '~/components/sidebar/MomentTopicCard.vue'

const { list: momentList } = useMomentList()

const route = useRoute()
const router = useRouter()

// 路由 param 已 URL 解码（Nuxt/Vue Router 自动处理）
const topicName = computed(() => String(route.params.name ?? ''))

const topicMeta = computed(() => findMomentTopic(topicName.value))

// 仅过滤话题，不复用分页/搜索（话题页只关心该话题的全部条目）
const filteredMoments = computed(() => momentList.value.filter((m) => m.topics?.includes(topicName.value)))

// hero 区配色：以话题色作主调
const heroStyle = computed(() => {
  const color = topicMeta.value?.color ?? 'var(--accent)'
  return {
    '--topic-color': color,
  }
})

// SEO
useSeoMeta({
  title: () => `#${topicName.value}`,
  description: () =>
    topicMeta.value?.description ?? `朋友圈中关于 #${topicName.value} 的全部 ${filteredMoments.value.length} 条动态`,
  ogTitle: () => `#${topicName.value} - TixXin 朋友圈`,
  ogDescription: () =>
    topicMeta.value?.description ?? `共 ${filteredMoments.value.length} 条动态，记录关于 ${topicName.value} 的点滴`,
})

// 侧栏
const authorStats = mockMomentAuthorStats

const momentTopics = computed<MomentTopic[]>(() =>
  MOMENT_TOPIC_DEFINITIONS.map((t) => ({
    ...t,
    count: momentList.value.filter((m) => m.topics?.includes(t.name)).length,
  })),
)

function onTopicSelect(topic: string | null) {
  if (!topic) {
    router.push('/moments')
    return
  }
  if (topic === topicName.value) return
  router.push(`/moments/topic/${encodeURIComponent(topic)}`)
}
</script>

<style lang="scss" scoped>
.moment-topic-page {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.moment-topic-header {
  display: flex;
  align-items: center;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  background: transparent;
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

.moment-topic-body {
  flex: 1;
  min-height: 0;
}

:deep(.moment-topic-viewport) {
  padding: 1.5rem 1rem;

  @media (min-width: $breakpoint-md) {
    padding: 2rem;
  }
}

.moment-topic-content {
  max-width: 800px;
  margin: 0 auto;
}

.moment-topic-hero {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem 1.5rem;
  margin-bottom: 1.25rem;
  background: linear-gradient(135deg, color-mix(in srgb, var(--topic-color) 12%, transparent), var(--surface-2));
  border: 1px solid color-mix(in srgb, var(--topic-color) 25%, var(--border-soft));
  border-radius: $radius-md;

  &--unknown {
    background: var(--surface-2);
    border-color: var(--border-soft);
  }
}

.moment-topic-hero__icon {
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--topic-color) 20%, transparent);
  color: var(--topic-color);
  border-radius: $radius-md;
}

.moment-topic-hero__text {
  flex: 1;
  min-width: 0;
}

.moment-topic-hero__name {
  margin: 0 0 0.25rem;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-main);
  line-height: 1.3;
}

.moment-topic-hero__desc {
  margin: 0 0 0.25rem;
  font-size: 0.875rem;
  color: var(--text-soft);
}

.moment-topic-hero__count {
  margin: 0;
  font-size: 0.75rem;
  color: var(--text-faint);
}
</style>
