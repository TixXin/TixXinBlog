<!--
  @file ProjectCard.vue
  @description 项目卡片组件，展示封面、状态标签、Star 数、描述、技术标签和链接
  @author TixXin
  @since 2025-03-17
-->

<template>
  <div class="project-card">
    <div class="project-card__cover">
      <NuxtImg :src="project.cover" :alt="project.title" loading="lazy" format="webp" />
      <div class="project-card__overlay" />
      <div class="project-card__badges">
        <span class="project-card__status" :class="`project-card__status--${project.status}`">
          {{ statusLabel }}
        </span>
        <span class="project-card__stars">
          <Icon name="lucide:star" size="12" /> {{ project.stars }}
        </span>
      </div>
    </div>
    <div class="project-card__body">
      <h3 class="project-card__title">{{ project.title }}</h3>
      <p class="project-card__desc">{{ project.description }}</p>
      <div class="project-card__tags">
        <span
          v-for="tag in project.tags"
          :key="tag.label"
          class="project-card__tag"
          :class="`project-card__tag--${tag.color}`"
        >
          {{ tag.label }}
        </span>
      </div>
      <div class="project-card__links">
        <a
          v-for="link in project.links"
          :key="link.label"
          :href="link.href"
          class="project-card__link"
          target="_blank"
          rel="noopener"
        >
          <Icon :name="link.icon" size="14" /> {{ link.label }}
        </a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ProjectItem } from '~/features/project/types'

const props = defineProps<{
  project: ProjectItem
}>()

const statusMap: Record<string, string> = {
  active: '维护中',
  dev: '开发中',
  archived: '归档',
}

const statusLabel = computed(() => statusMap[props.project.status] ?? props.project.status)
</script>

<style lang="scss" scoped>
.project-card {
  background: var(--surface-1);
  border: 1px solid var(--border);
  border-radius: $radius-card;
  overflow: hidden;
  transition: $transition-normal;

  &:hover {
    box-shadow: var(--shadow-card-hover);
    border-color: var(--border-hover);

    .project-card__cover img {
      transform: scale(1.05);
    }
  }
}

.project-card__cover {
  height: 10rem;
  overflow: hidden;
  position: relative;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.5s ease;
  }
}

.project-card__overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.4), transparent);
}

.project-card__badges {
  position: absolute;
  bottom: 0.75rem;
  left: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.project-card__status {
  padding: 0.125rem 0.5rem;
  font-size: 10px;
  font-weight: 700;
  border-radius: 0.25rem;
  color: #fff;

  &--active { background: #10b981; }
  &--dev { background: #f59e0b; }
  &--archived { background: #64748b; }
}

.project-card__stars {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.75rem;
}

.project-card__body {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.project-card__title {
  font-size: 1rem;
  font-weight: 700;
  margin: 0;
}

.project-card__desc {
  font-size: 0.75rem;
  color: var(--text-muted);
  line-height: 1.6;
  margin: 0;
}

.project-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.project-card__tag {
  padding: 0.125rem 0.5rem;
  font-size: 10px;
  font-weight: 600;
  border-radius: 0.25rem;

  &--emerald { background: var(--tag-emerald-bg); color: var(--tag-emerald-text); }
  &--blue { background: var(--tag-blue-bg); color: var(--tag-blue-text); }
  &--amber { background: var(--tag-amber-bg); color: var(--tag-amber-text); }
  &--sky { background: var(--tag-sky-bg); color: var(--tag-sky-text); }
  &--rose { background: var(--tag-rose-bg); color: var(--tag-rose-text); }
  &--slate { background: var(--surface-3); color: var(--text-muted); }
}

.project-card__links {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--border);
}

.project-card__link {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.75rem;
  color: var(--text-soft);
  text-decoration: none;
  transition: color 0.2s;

  &:hover {
    color: var(--text-main);
  }
}
</style>
