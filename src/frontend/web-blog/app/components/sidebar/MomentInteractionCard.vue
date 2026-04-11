<!--
  @file MomentInteractionCard.vue
  @description 朋友圈右侧栏互动之星卡片：展示评论活跃用户排行榜（Top 5）
  @author TixXin
  @since 2026-04-11
-->

<template>
  <section class="card moment-interaction-card">
    <header class="moment-interaction-card__header">
      <h3 class="moment-interaction-card__title">
        <Icon name="lucide:sparkles" size="14" class="moment-interaction-card__title-icon" />
        互动之星
      </h3>
      <span class="moment-interaction-card__count">{{ totalUsers }} 位朋友</span>
    </header>

    <ul v-if="users.length" class="moment-interaction-card__list">
      <li
        v-for="(user, index) in users"
        :key="user.name"
        class="moment-interaction-card__item"
      >
        <span class="moment-interaction-card__rank" :class="rankClass(index)">{{ index + 1 }}</span>
        <div class="moment-interaction-card__avatar-wrap">
          <NuxtImg
            :src="user.avatar"
            :alt="user.name"
            width="32"
            height="32"
            class="moment-interaction-card__avatar"
            format="webp"
            loading="lazy"
          />
        </div>
        <div class="moment-interaction-card__info">
          <span class="moment-interaction-card__name">{{ user.name }}</span>
          <span class="moment-interaction-card__meta">
            <Icon name="lucide:message-circle" size="11" />
            {{ user.commentCount }} 条评论
          </span>
        </div>
      </li>
    </ul>

    <p v-else class="moment-interaction-card__empty">暂无互动数据</p>
  </section>
</template>

<script setup lang="ts">
export interface MomentActiveUser {
  name: string
  avatar: string
  commentCount: number
}

defineProps<{
  users: MomentActiveUser[]
  totalUsers: number
}>()

/** 前三名高亮色（金/银/铜） */
function rankClass(index: number): string {
  if (index === 0) return 'is-first'
  if (index === 1) return 'is-second'
  if (index === 2) return 'is-third'
  return ''
}
</script>

<style lang="scss" scoped>
.moment-interaction-card {
  padding: 1rem 1.125rem 1.125rem;
}

.moment-interaction-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.875rem;
}

.moment-interaction-card__title {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--text-main);
  margin: 0;
}

.moment-interaction-card__title-icon {
  color: var(--accent);
}

.moment-interaction-card__count {
  font-size: 0.6875rem;
  color: var(--text-muted);
  padding: 0.125rem 0.5rem;
  background: var(--surface-2);
  border-radius: $radius-full;
}

.moment-interaction-card__list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0;
  margin: 0;
  list-style: none;
}

.moment-interaction-card__item {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.375rem 0.5rem;
  border-radius: $radius-sm;
  transition: background-color 0.2s ease, transform 0.2s ease;

  &:hover {
    background: var(--surface-2);
    transform: translateX(2px);
  }
}

/* 排名徽章 */
.moment-interaction-card__rank {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 0.6875rem;
  font-weight: 700;
  color: var(--text-muted);
  background: var(--surface-2);

  &.is-first {
    color: #fff;
    background: linear-gradient(135deg, #fbbf24, #f59e0b);
    box-shadow: 0 2px 6px rgba(245, 158, 11, 0.35);
  }

  &.is-second {
    color: #fff;
    background: linear-gradient(135deg, #d1d5db, #9ca3af);
    box-shadow: 0 2px 6px rgba(156, 163, 175, 0.3);
  }

  &.is-third {
    color: #fff;
    background: linear-gradient(135deg, #fdba74, #c2834a);
    box-shadow: 0 2px 6px rgba(194, 131, 74, 0.3);
  }
}

/* 头像容器 */
.moment-interaction-card__avatar-wrap {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  overflow: hidden;
  border: 1.5px solid var(--border-soft);
  background: var(--surface-2);
}

.moment-interaction-card__avatar {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.moment-interaction-card__info {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
  flex: 1;
}

.moment-interaction-card__name {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-main);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.moment-interaction-card__meta {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.6875rem;
  color: var(--text-muted);
}

.moment-interaction-card__empty {
  font-size: 0.75rem;
  color: var(--text-faint);
  text-align: center;
  padding: 1rem 0;
  margin: 0;
}
</style>
