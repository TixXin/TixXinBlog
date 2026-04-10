<!--
  @file MomentTopicCard.vue
  @description 朋友圈右侧栏热门话题卡，支持点击筛选
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
    </div>

    <ul class="moment-topic-card__list">
      <!-- 全部选项 -->
      <li class="moment-topic-card__item" :class="{ 'is-active': !activeTopic }" @click="emit('select', null)">
        <div class="moment-topic-card__item-left">
          <span class="moment-topic-card__tag-icon moment-topic-card__tag-icon--all">
            <Icon name="lucide:layers" size="14" />
          </span>
          <div class="moment-topic-card__item-info">
            <span class="moment-topic-card__tag-name">#全部</span>
            <span class="moment-topic-card__tag-desc">查看所有动态</span>
          </div>
        </div>
      </li>

      <li
        v-for="topic in topics"
        :key="topic.name"
        class="moment-topic-card__item"
        :class="{ 'is-active': activeTopic === topic.name }"
        @click="emit('select', topic.name)"
      >
        <div class="moment-topic-card__item-left">
          <span class="moment-topic-card__tag-icon" :style="{ background: topic.color + '18', color: topic.color }">
            <Icon :name="topic.icon" size="14" />
          </span>
          <div class="moment-topic-card__item-info">
            <span class="moment-topic-card__tag-name">#{{ topic.name }}</span>
            <span class="moment-topic-card__tag-desc">{{ topic.description }}</span>
          </div>
        </div>
        <span class="moment-topic-card__count">{{ topic.count }}</span>
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

defineProps<{
  topics: MomentTopic[]
  activeTopic?: string | null
}>()

const emit = defineEmits<{
  select: [topicName: string | null]
}>()
</script>

<style lang="scss" scoped>
.moment-topic-card {
  padding: 1.25rem;
}

.moment-topic-card__header {
  margin-bottom: 0.75rem;
}

.moment-topic-card__title {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.875rem;
  font-weight: 700;
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
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.625rem 0.75rem;
  border-radius: $radius-md;
  cursor: pointer;
  transition: all 0.2s ease;

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

.moment-topic-card__item-left {
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

  &--all {
    background: var(--accent-soft);
    color: var(--accent);
  }
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

.moment-topic-card__count {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--text-muted);
  background: var(--surface-3);
  padding: 2px 8px;
  border-radius: $radius-full;
  line-height: 1.4;
  flex-shrink: 0;
}
</style>
