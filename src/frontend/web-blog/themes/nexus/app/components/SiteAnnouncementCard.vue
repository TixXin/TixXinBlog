<!--
  @file SiteAnnouncementCard.vue
  @description Nexus 左侧栏站点公告卡片，展示最近公告列表
  @author TixXin
  @since 2026-04-10
-->

<template>
  <section v-if="announcements.length" class="card announcement-card">
    <!-- 标题 -->
    <div class="announcement-card__header">
      <Icon name="lucide:megaphone" size="14" />
      <span>公告</span>
    </div>

    <!-- 公告列表 -->
    <ul class="announcement-card__list">
      <li v-for="item in announcements" :key="item.id" class="announcement-card__item">
        <span class="announcement-card__dot" :class="{ '--pinned': item.pinned }" />
        <div class="announcement-card__body">
          <p class="announcement-card__text">{{ item.content }}</p>
          <time class="announcement-card__date">{{ item.date }}</time>
        </div>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
const { announcements } = useSiteInfo()
</script>

<style lang="scss" scoped>
.announcement-card {
  padding: 1rem 1.25rem;
}

.announcement-card__header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--text-main);
  margin-bottom: 0.75rem;
}

.announcement-card__list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.announcement-card__item {
  display: flex;
  align-items: flex-start;
  gap: 0.625rem;
}

.announcement-card__dot {
  flex-shrink: 0;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-faint);
  margin-top: 0.4375rem;
  transition: background-color 0.2s;

  &.--pinned {
    background: var(--accent);
  }
}

.announcement-card__body {
  min-width: 0;
}

.announcement-card__text {
  font-size: 0.8125rem;
  color: var(--text-main);
  line-height: 1.5;
}

.announcement-card__date {
  font-size: 0.6875rem;
  color: var(--text-faint);
  margin-top: 0.125rem;
  display: block;
}
</style>
