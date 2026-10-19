<!-- @file Card.vue @description 图片优先的提示词作品，效果图和标题进入详情，编辑入口独立 -->
<template>
  <article class="prompt-card" :data-prompt-id="item.id">
    <div class="prompt-card__visual">
      <CommonImageFrame
        :src="item.imageUrl"
        :alt="item.imageAlt || item.title"
        :width="item.width || undefined"
        :height="item.height || undefined"
        :priority="priority"
        sizes="(min-width: 640px) 330px, 50vw"
      />
      <button
        type="button"
        class="prompt-card__open"
        :aria-label="$t('misc.prompt.card.open', { title: item.title })"
        :data-focus-key="`prompt-open-${item.id}`"
        :disabled="!ready"
        @click="$emit('open', item.id)"
      >
        <span class="prompt-card__open-label"
          ><Icon name="lucide:scan-text" size="16" />{{ $t('misc.prompt.card.openLabel')
          }}<Icon name="lucide:arrow-up-right" size="15"
        /></span>
      </button>
      <span v-if="status === 'draft'" class="prompt-card__draft">{{ $t('misc.prompt.shared.draft') }}</span>
    </div>
    <div class="prompt-card__caption">
      <div class="prompt-card__meta">
        <span>{{ item.model || $t('misc.prompt.shared.modelUnset') }}</span
        ><span v-if="item.tags[0]">{{ item.tags[0] }}</span>
      </div>
      <div class="prompt-card__title-row">
        <h2>
          <CommonTooltip :content="item.title" placement="top">
            <button
              type="button"
              :disabled="!ready"
              :data-focus-key="`prompt-title-${item.id}`"
              @click="$emit('open', item.id)"
            >
              {{ item.title }}
            </button>
          </CommonTooltip>
        </h2>
        <button
          v-if="editable"
          class="prompt-card__edit"
          type="button"
          :aria-label="$t('misc.prompt.card.edit', { title: item.title })"
          :data-focus-key="`prompt-edit-${item.id}`"
          :disabled="!ready"
          @click="$emit('edit', item.id)"
        >
          <Icon name="lucide:pencil" size="15" />
        </button>
      </div>
      <p v-if="item.description">{{ item.description }}</p>
    </div>
  </article>
</template>
<script setup lang="ts">
import type { ImagePrompt, PromptStatus } from '~/features/prompt/types'
// priority：首行作品立即加载；瀑布流列宽实测不超过约 330px，窄屏两列各约半屏
defineProps<{
  item: ImagePrompt
  ready: boolean
  editable?: boolean
  status?: PromptStatus
  priority?: boolean
}>()
defineEmits<{ open: [id: number]; edit: [id: number] }>()
</script>
<style scoped lang="scss">
.prompt-card {
  break-inside: avoid;
  margin: 0 0 1.6rem;
  min-width: 0;
  overflow-wrap: anywhere;
}
.prompt-card__visual {
  position: relative;
  overflow: hidden;
  border-radius: 0.875rem;
  border: 1px solid var(--border);
  background: var(--surface-2);
}
.prompt-card__visual :deep(.image-frame__status) {
  z-index: 2;
  pointer-events: none;
}
.prompt-card__visual :deep(.image-frame__status button) {
  pointer-events: auto;
}
.prompt-card__open {
  position: absolute;
  inset: 0;
  width: 100%;
  border: 0;
  background: transparent;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 1rem;
}
.prompt-card__open-label {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--surface-1);
  color: var(--text-main);
  border: 1px solid var(--border);
  border-radius: 2rem;
  padding: 0.65rem 0.9rem;
  font-size: 0.75rem;
  opacity: 0;
  transform: translateY(0.4rem);
  transition:
    opacity 0.2s,
    transform 0.2s;
}
.prompt-card__open:hover .prompt-card__open-label,
.prompt-card__open:focus-visible .prompt-card__open-label {
  opacity: 1;
  transform: none;
}
.prompt-card__open:focus-visible {
  outline: 3px solid var(--accent);
  outline-offset: -4px;
}
.prompt-card__draft {
  position: absolute;
  top: 0.75rem;
  left: 0.75rem;
  padding: 0.25rem 0.65rem;
  border-radius: 2rem;
  background: var(--surface-1);
  color: var(--text-main);
  font-size: 0.7rem;
  pointer-events: none;
}
.prompt-card__caption {
  padding: 0.9rem 0.15rem 0;
}
.prompt-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem 0.5rem;
  align-items: center;
  color: var(--text-soft);
  font-size: 0.7rem;
  letter-spacing: 0.05em;
}
.prompt-card__meta span + span::before {
  content: '/';
  margin-right: 0.5rem;
  color: var(--border);
}
.prompt-card__title-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.3rem;
}
h2 {
  flex: 1;
  min-width: 0;
  margin: 0;
  font-size: 0.94rem;
  line-height: 1.6;
  font-weight: 600;
}
h2 button {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-align: left;
  color: var(--text-main);
  padding: 0.15rem 0;
  min-height: 32px;
}
.prompt-card__edit {
  color: var(--text-soft);
  min-width: 36px;
  min-height: 36px;
  border-radius: 0.5rem;
}
.prompt-card__edit:hover {
  background: var(--surface-2);
  color: var(--accent-text);
}
p {
  color: var(--text-soft);
  font-size: 0.8125rem;
  line-height: 1.7;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-top: 0.15rem;
}
@media (hover: none) {
  .prompt-card__open {
    padding: 0.75rem;
  }
  .prompt-card__open-label {
    opacity: 1;
    transform: none;
    gap: 0.3rem;
    font-size: 0.68rem;
    padding: 0.4rem 0.65rem;
    white-space: nowrap;
  }
  // 窄卡片上省略装饰箭头，保证“查看提示词”不折行
  .prompt-card__open-label > :last-child {
    display: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .prompt-card__open-label {
    transition: none;
  }
}
</style>
