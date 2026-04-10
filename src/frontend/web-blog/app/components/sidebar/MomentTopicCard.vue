<!--
  @file MomentTopicCard.vue
  @description 朋友圈右侧栏热门话题卡，支持点击筛选，按热度排序，带比例条可视化
  @author TixXin
  @since 2026-04-07
-->

<template>
  <section class="card moment-topic-card">
    <div class="moment-topic-card__header">
      <h3 class="moment-topic-card__title">
        <Icon name="lucide:hash" size="16" />
        热门话题
      </h3>
      <button
        type="button"
        class="moment-topic-card__view-all"
        :class="{ 'is-active': !activeTopic }"
        @click="emit('select', null)"
      >
        全部
      </button>
    </div>

    <ul class="moment-topic-card__list">
      <li
        v-for="(topic, index) in sortedTopics"
        :key="topic.name"
        class="moment-topic-card__item"
        :class="{ 'is-active': activeTopic === topic.name }"
        @click="emit('select', topic.name)"
      >
        <!-- 背景比例条 -->
        <span
          class="moment-topic-card__bar"
          :style="{ width: barWidth(topic.count), background: topic.color + '08' }"
        />
        <div class="moment-topic-card__item-left">
          <span class="moment-topic-card__tag-icon" :style="{ background: topic.color + '18', color: topic.color }">
            <Icon :name="topic.icon" size="14" />
          </span>
          <div class="moment-topic-card__item-info">
            <span class="moment-topic-card__tag-name">#{{ topic.name }}</span>
            <span class="moment-topic-card__tag-desc">{{ topic.description }}</span>
          </div>
        </div>
        <div class="moment-topic-card__item-right">
          <span v-if="index === 0" class="moment-topic-card__hot">HOT</span>
          <span class="moment-topic-card__count">{{ topic.count }}</span>
        </div>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
export interface MomentTopic {
  name: string
  icon: string
  color: string
  count: number
  description: string
}

const props = defineProps<{
  topics: MomentTopic[]
  activeTopic?: string | null
}>()

const emit = defineEmits<{
  select: [topicName: string | null]
}>()

/** 按计数降序排序 */
const sortedTopics = computed(() => [...props.topics].sort((a, b) => b.count - a.count))

/** 最大计数值，用于比例条宽度计算 */
const maxCount = computed(() => Math.max(...props.topics.map((t) => t.count), 1))

/** 计算比例条宽度百分比 */
function barWidth(count: number): string {
  return `${(count / maxCount.value) * 100}%`
}
</script>

<style lang="scss" scoped>
.moment-topic-card {
  padding: 1.25rem;
}

.moment-topic-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.moment-topic-card__title {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.875rem;
  font-weight: 700;
}

.moment-topic-card__view-all {
  border: none;
  background: var(--surface-2);
  color: var(--text-soft);
  font-size: 0.6875rem;
  font-weight: 600;
  padding: 0.25rem 0.625rem;
  border-radius: $radius-full;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover,
  &.is-active {
    background: var(--accent-soft);
    color: var(--accent);
  }
}

.moment-topic-card__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.moment-topic-card__item {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.625rem 0.75rem;
  border-radius: $radius-md;
  cursor: pointer;
  transition: all 0.2s ease;
  overflow: hidden;

  &:hover {
    background: var(--accent-soft);

    .moment-topic-card__tag-name {
      color: var(--accent);
    }
  }

  &.is-active {
    background: var(--accent-soft);

    .moment-topic-card__tag-name {
      color: var(--accent);
      font-weight: 700;
    }
  }
}

.moment-topic-card__bar {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  border-radius: $radius-md;
  transition: width 0.3s ease;
  pointer-events: none;
}

.moment-topic-card__item-left {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
}

.moment-topic-card__tag-icon {
  width: 2rem;
  height: 2rem;
  border-radius: $radius-sm;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.moment-topic-card__item-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.moment-topic-card__tag-name {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-main);
  transition: color 0.15s;
}

.moment-topic-card__tag-desc {
  font-size: 0.6875rem;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.moment-topic-card__item-right {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.375rem;
  flex-shrink: 0;
}

.moment-topic-card__hot {
  font-size: 0.5625rem;
  font-weight: 700;
  color: #fff;
  background: var(--accent);
  padding: 1px 5px;
  border-radius: $radius-full;
  line-height: 1.4;
  letter-spacing: 0.5px;
}

.moment-topic-card__count {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--text-muted);
  background: var(--surface-3);
  padding: 2px 8px;
  border-radius: $radius-full;
  line-height: 1.4;
}
</style>
