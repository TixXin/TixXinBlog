<!-- @file ProfileContent.vue @description 仅展示已选择公开的个人资料，空栏目不占位；经历、技能、兴趣、书单各用贴合内容的版式 -->
<template>
  <div v-if="visible.visible" class="profile-content">
    <p v-if="visible.introduction" class="profile-content__intro">{{ visible.introduction }}</p>
    <section v-for="section in visible.sections" :key="section.kind" class="profile-content__section">
      <h2 class="profile-content__heading">
        <Icon :name="sectionIcons[section.kind]" size="18" /> {{ aboutSectionLabel(section.kind, t) }}
      </h2>
      <!-- 经历：时间线，时间段作为标签 -->
      <ol v-if="section.kind === 'experience'" class="profile-timeline">
        <li v-for="(item, index) in section.items" :key="index" class="profile-timeline__item">
          <span class="profile-timeline__dot" aria-hidden="true" />
          <p v-if="item.period" class="profile-timeline__period">{{ item.period }}</p>
          <h3 class="profile-timeline__title">{{ item.title }}</h3>
          <p v-if="item.detail" class="profile-content__detail">{{ item.detail }}</p>
        </li>
      </ol>
      <!-- 兴趣：标签，说明放在提示里；有说明的标签可聚焦，触屏点按也能看到 -->
      <ul v-else-if="section.kind === 'interest'" class="profile-chips">
        <li v-for="(item, index) in section.items" :key="index">
          <CommonTooltip :content="item.detail || undefined" :disabled="!item.detail">
            <span
              class="profile-chips__item"
              :class="{ 'profile-chips__item--detail': item.detail }"
              :tabindex="item.detail ? 0 : undefined"
            >
              {{ item.title }}
            </span>
          </CommonTooltip>
        </li>
      </ul>
      <!-- 技能与书单：两列卡片；书单的时间段字段作为作者 -->
      <ul v-else class="profile-grid">
        <li v-for="(item, index) in section.items" :key="index" class="profile-grid__item">
          <div class="profile-grid__head">
            <h3 class="profile-grid__title">
              <Icon
                v-if="section.kind === 'reading'"
                class="profile-grid__icon"
                name="lucide:book-open"
                size="14"
              /><span>{{ item.title }}</span>
            </h3>
            <span v-if="item.period" class="profile-grid__meta">{{ item.period }}</span>
          </div>
          <p v-if="item.detail" class="profile-content__detail">{{ item.detail }}</p>
        </li>
      </ul>
    </section>
  </div>
</template>
<script setup lang="ts">
import type { AboutSettings } from '~/features/about/types'
import { aboutSectionLabel, publicAbout } from '~/features/about/settings'
const { t } = useI18n()
const props = defineProps<{ value?: AboutSettings }>()
const visible = computed(() => publicAbout(props.value))
const sectionIcons = {
  experience: 'lucide:clock',
  skill: 'lucide:zap',
  interest: 'lucide:heart',
  reading: 'lucide:book-open',
} as const
</script>
<style scoped lang="scss">
.profile-content {
  overflow-wrap: anywhere;
  margin-bottom: 2rem;
}
.profile-content__intro {
  white-space: pre-wrap;
  line-height: 1.9;
  color: var(--text-main);
}
.profile-content__section {
  margin-block: 2rem;
}
.profile-content__heading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 1rem;
}
.profile-content__detail {
  white-space: pre-wrap;
  line-height: 1.7;
  font-size: 0.85rem;
  color: var(--text-muted);
}
.profile-timeline {
  list-style: none;
  padding: 0 0 0 1.5rem;
  margin: 0;
  /* 2px 线在暗色下也能看清；圆点按线宽居中 */
  border-left: 2px solid var(--border);
}
.profile-timeline__item {
  position: relative;
  padding-bottom: 1.5rem;
  &:last-child {
    padding-bottom: 0;
  }
}
.profile-timeline__dot {
  position: absolute;
  left: calc(-1.5rem - 1px - 0.3125rem);
  top: 0.35rem;
  width: 0.625rem;
  height: 0.625rem;
  border-radius: 50%;
  background: var(--text-soft);
  box-shadow: 0 0 0 3px var(--surface-1, var(--bg-card));
}
.profile-timeline__period {
  display: inline-block;
  padding: 0.125rem 0.5rem;
  margin-bottom: 0.375rem;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  color: var(--text-muted);
  background: var(--surface-2);
}
.profile-timeline__title {
  font-weight: 600;
  margin-bottom: 0.25rem;
}
.profile-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  list-style: none;
  padding: 0;
  margin: 0;
}
.profile-chips__item {
  display: inline-block;
  padding: 0.375rem 0.75rem;
  border-radius: 0.5rem;
  font-size: 0.85rem;
  background: var(--surface-2);
  border: 1px solid var(--border);
  color: var(--text-main);
}
.profile-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 15rem), 1fr));
  gap: 0.75rem;
  list-style: none;
  padding: 0;
  margin: 0;
}
.profile-grid__item {
  padding: 0.875rem 1rem;
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  background: var(--surface-2);
}
.profile-chips__item--detail {
  cursor: help;
  transition: border-color 0.15s ease;
  &:hover {
    border-color: var(--border-hover);
  }
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}
/* 标题可能折行：图标与右侧元信息都对齐首行，而不是整块居中 */
.profile-grid__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}
.profile-grid__title {
  display: flex;
  align-items: flex-start;
  gap: 0.375rem;
  min-width: 0;
  font-weight: 600;
  font-size: 0.95rem;
  line-height: 1.5;
}
.profile-grid__icon {
  flex-shrink: 0;
  margin-top: calc((1.5em - 14px) / 2);
}
.profile-grid__meta {
  flex-shrink: 0;
  font-size: 0.75rem;
  line-height: calc(0.95rem * 1.5);
  color: var(--text-soft);
}
</style>
