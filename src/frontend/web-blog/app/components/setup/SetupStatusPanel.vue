<!--
  @file SetupStatusPanel.vue
  @description 初始化向导表单以外的三种状态：确认中（占出表单轮廓的骨架，避免加载完成后卡片高度突变）、
               已关闭（引导前往登录）、状态读取失败（重试）
-->
<template>
  <div v-if="phase === 'checking'" class="status-skeleton" role="status">
    <span class="sr-only">{{ t('admin-system.setup.checking') }}</span>
    <div v-for="index in 4" :key="index" class="status-skeleton__field" aria-hidden="true">
      <span class="status-skeleton__label" />
      <span class="status-skeleton__input" />
    </div>
    <span class="status-skeleton__button" aria-hidden="true" />
  </div>
  <div v-else-if="phase === 'closed'" class="status-notice" role="status">
    <p>{{ t('admin-system.setup.unavailable') }}</p>
    <NuxtLink to="/admin/login" class="btn-primary status-notice__action"
      >{{ t('admin-system.setup.toLogin') }}<Icon name="lucide:arrow-right" aria-hidden="true"
    /></NuxtLink>
  </div>
  <div v-else-if="phase === 'error'" class="status-notice" role="alert">
    <p>{{ t('admin-system.setup.statusFailed') }}</p>
    <button type="button" class="btn-primary status-notice__action" @click="emit('retry')">
      <Icon name="lucide:rotate-cw" aria-hidden="true" />{{ t('admin-system.setup.retry') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import type { SetupPhase } from '~/features/setup/types'

defineProps<{ phase: Exclude<SetupPhase, 'open'> }>()
const emit = defineEmits<{ retry: [] }>()
const { t } = useI18n()
</script>

<style scoped lang="scss">
.status-skeleton {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}
.status-skeleton__field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.status-skeleton__label,
.status-skeleton__input,
.status-skeleton__button {
  display: block;
  border-radius: $radius-sm;
  background: var(--surface-3);
  animation: status-pulse 1.4s ease-in-out infinite;
  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
}
.status-skeleton__label {
  width: 5rem;
  height: 0.875rem;
}
.status-skeleton__input,
.status-skeleton__button {
  height: 2.75rem;
  border-radius: $radius-md;
}
.status-skeleton__button {
  margin-top: 0.5rem;
}
@keyframes status-pulse {
  50% {
    opacity: 0.5;
  }
}
.status-notice {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: stretch;

  p {
    margin: 0;
  }
}
.status-notice__action {
  gap: 0.5rem;
  min-height: 2.75rem;
}
</style>
