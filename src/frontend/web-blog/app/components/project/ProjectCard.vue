<!--
  @file ProjectCard.vue
  @description 项目卡片，展示真实封面、项目进展、技术标签与有效链接
  @author TixXin
  @since 2025-03-17
-->

<template>
  <article class="project-card" :data-project-id="project.id" tabindex="-1">
    <div class="project-card__cover">
      <CommonImageFrame
        v-if="project.cover"
        :src="project.cover"
        :alt="project.title"
        :width="project.width ?? undefined"
        :height="project.height ?? undefined"
        class="project-card__image"
      />
      <div v-else class="project-card__no-cover">
        <Icon name="lucide:panels-top-left" size="32" /><span>暂无封面</span>
      </div>
      <div v-if="project.cover" class="project-card__overlay" />
      <div class="project-card__badges">
        <span class="project-card__status" :class="`project-card__status--${project.progress}`">
          {{ statusLabel }}
        </span>
      </div>
    </div>
    <div class="project-card__body">
      <h3 class="project-card__title">{{ project.title }}</h3>
      <p class="project-card__desc">{{ project.description }}</p>
      <div class="project-card__tags">
        <button
          v-for="tag in project.tags"
          :key="tag.label"
          class="project-card__tag"
          :class="`project-card__tag--${tag.color}`"
          type="button"
          :aria-label="`筛选技术：${tag.label}`"
          :disabled="!interactive"
          @click="$emit('tag', tag.label)"
        >
          {{ tag.label }}
        </button>
      </div>
      <div class="project-card__links">
        <template v-for="link in project.links" :key="link.kind">
          <a :href="link.href" class="project-card__link" target="_blank" rel="noopener noreferrer">
            <Icon :name="link.icon" size="14" /> {{ link.label }}
          </a>
        </template>
        <p v-if="!project.links.length" class="project-card__link--unavailable">尚未提供公开链接</p>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { projectProgressLabels } from '~/features/project/types'
import type { ProjectItem } from '~/features/project/types'
const props = defineProps<{ project: ProjectItem; interactive: boolean }>()
defineEmits<{ tag: [label: string] }>()
const statusLabel = computed(() => projectProgressLabels[props.project.progress])
</script>

<style lang="scss" scoped>
.project-card__link--unavailable {
  color: var(--text-soft);
  cursor: default;
}
.project-card {
  min-width: 0;
  overflow-wrap: anywhere;
  background: var(--surface-1);
  border: 1px solid var(--border);
  border-radius: $radius-card;
  overflow: hidden;
  transition: $transition-normal;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    box-shadow: var(--shadow-card-hover);
    border-color: var(--border-hover);

    .project-card__cover :deep(img) {
      transform: scale(1.05);
    }
  }
}

.project-card__cover {
  height: 10rem;
  overflow: hidden;
  position: relative;

  :deep(img) {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.5s ease;
    @media (prefers-reduced-motion: reduce) {
      transition: none;
    }
  }
}
.project-card__image {
  width: 100%;
  height: 100%;
}
.project-card__no-cover {
  display: flex;
  height: 100%;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 0.5rem;
  color: var(--text-muted);
  background: var(--surface-2);
}

.project-card__overlay {
  pointer-events: none;
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

  &--active {
    background: #047857;
  }
  &--dev {
    background: #92400e;
  }
  &--archived {
    background: #475569;
  }
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
  min-height: 44px;
  max-width: 100%;
  overflow-wrap: anywhere;
  border: 0;
  cursor: pointer;
  padding: 0.125rem 0.5rem;
  font-size: 10px;
  font-weight: 600;
  border-radius: 0.25rem;

  &--emerald {
    background: var(--tag-emerald-bg);
    color: var(--tag-emerald-text);
  }
  &--blue {
    background: var(--tag-blue-bg);
    color: var(--tag-blue-text);
  }
  &--amber {
    background: var(--tag-amber-bg);
    color: var(--tag-amber-text);
  }
  &--sky {
    background: var(--tag-sky-bg);
    color: var(--tag-sky-text);
  }
  &--rose {
    background: var(--tag-rose-bg);
    color: var(--tag-rose-text);
  }
  &--slate {
    background: var(--surface-3);
    color: var(--text-muted);
  }
}

.project-card__links {
  flex-wrap: wrap;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--border);
}

.project-card__link {
  min-height: 44px;
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.75rem;
  color: var(--text-soft);
  text-decoration: none;
  transition: color 0.2s;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    color: var(--text-main);
  }
}
</style>
