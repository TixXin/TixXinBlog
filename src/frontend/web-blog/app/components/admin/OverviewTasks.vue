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
  color: var(--success-text);
}
// 待办：一行一项，有待办时数字为强调色
.overview__tasks {
  display: flex;
  flex-direction: column;

  a {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 2.75rem;
    padding: 0.375rem 0.5rem;
    border-radius: 0.625rem;
    color: var(--text-muted);
    font-size: 0.875rem;
    text-decoration: none;

    &:hover {
      background: var(--surface-2);
      color: var(--text-main);
    }
    > span:first-child {
      flex: 1;
      min-width: 0;
    }
    strong {
      color: var(--text-soft);
      font-size: 0.9375rem;
      font-weight: 600;
    }
    &.is-pending strong {
      min-width: 1.75rem;
      padding: 0.0625rem 0.5rem;
      border-radius: 999px;
      background: var(--accent-soft);
      color: var(--accent-text);
      text-align: center;
    }
    :deep(.iconify),
    :deep(svg) {
      color: var(--text-soft);
    }
  }
}
details {
  margin-top: 0.75rem;
  font-size: 0.8125rem;

  summary {
    color: var(--text-soft);
    cursor: var(--interaction-cursor, pointer);
  }
}
</style>
