<!-- @file OverviewTasks.vue @description 管理概览的待处理互动：六类审核与回复待办各一行，有待办时数字高亮，统计不可用时提示重新读取 -->
<template>
  <section class="admin-card" aria-labelledby="overview-tasks">
    <h2 id="overview-tasks">{{ t('admin-system.overview.tasksTitle') }}</h2>
    <p v-if="!counts" role="alert">
      {{ t('admin-system.overview.countsUnavailable')
      }}<button type="button" :disabled="pending" @click="$emit('reload')">
        {{ t('admin-system.overview.reloadCounts') }}
      </button>
    </p>
    <template v-else>
      <p v-if="overviewTasks.every((task) => counts![task.key] === 0)" class="overview__empty">
        <Icon name="lucide:circle-check" aria-hidden="true" />{{ t('admin-system.overview.noTasks') }}
      </p>
      <div class="overview__stats overview__tasks">
        <NuxtLink
          v-for="task in overviewTasks"
          :key="task.key"
          :to="task.to"
          :class="{ 'is-pending': counts[task.key] }"
        >
          <span>{{ t(task.labelKey) }}</span
          ><strong>{{ counts[task.key] }}</strong
          ><Icon name="lucide:chevron-right" aria-hidden="true" />
        </NuxtLink>
      </div>
    </template>
    <details>
      <summary>{{ t('admin-system.overview.countingRules') }}</summary>
      <p>{{ t('admin-system.overview.rulesUnanswered') }}</p>
      <p>{{ t('admin-system.overview.rulesPending') }}</p>
      <p>{{ t('admin-system.overview.rulesOther') }}</p>
    </details>
  </section>
</template>

<script setup lang="ts">
import { overviewTasks } from '~/features/admin/overview'

defineProps<{ counts: Record<string, number> | null; pending: boolean }>()
defineEmits<{ reload: [] }>()
const { t } = useI18n()
</script>

<style scoped lang="scss">
.overview__empty {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.75rem;
  border-radius: 0.5rem;
  background: color-mix(in srgb, var(--success-text) 8%, transparent);
  color: var(--success-text);
  font-size: 0.875rem;
  font-weight: 500;
}
// 待办：一行一项，有待办时数字为强调色
.overview__tasks {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;

  a {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 2.375rem;
    padding: 0.375rem 0.625rem;
    border-radius: 0.5rem;
    color: var(--text-muted);
    font-size: 0.875rem;
    font-weight: 500;
    text-decoration: none;
    transition:
      background-color 0.15s ease,
      color 0.15s ease;

    @media (prefers-reduced-motion: reduce) {
      transition: none;

      :deep(.iconify),
      :deep(svg) {
        transition: none;
      }
    }
    &:hover {
      background: var(--surface-2);
      color: var(--text-main);

      :deep(.iconify),
      :deep(svg) {
        color: var(--text-main);
        @media (prefers-reduced-motion: no-preference) {
          transform: translateX(2px);
        }
      }
    }
    &:focus-visible {
      outline: 2px solid var(--focus-ring);
      outline-offset: 2px;
    }
    > span:first-child {
      flex: 1;
      min-width: 0;
    }
    strong {
      color: var(--text-soft);
      font-size: 0.875rem;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
    &.is-pending strong {
      min-width: 1.5rem;
      padding: 0.0625rem 0.5rem;
      border-radius: 999px;
      background: color-mix(in srgb, var(--warning-text) 12%, transparent);
      color: var(--warning-text);
      text-align: center;
      line-height: 1.4;
    }
    :deep(.iconify),
    :deep(svg) {
      color: var(--text-soft);
      font-size: 0.9375rem;
      transition:
        transform 0.15s ease,
        color 0.15s ease;
    }
  }
}
details {
  margin-top: 1rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-soft);
  border-radius: 0.5rem;
  background: var(--surface-2);
  font-size: 0.75rem;

  summary {
    color: var(--text-soft);
    cursor: var(--interaction-cursor, pointer);
    font-weight: 500;
    user-select: none;

    &:hover {
      color: var(--text-main);
    }
    &:focus-visible {
      outline: 2px solid var(--focus-ring);
      outline-offset: 2px;
    }
  }
  &[open] summary {
    margin-bottom: 0.5rem;
    color: var(--text-main);
  }
  p {
    margin: 0.25rem 0 0;
    color: var(--text-muted);
    line-height: 1.5;
  }
}
</style>
