<!-- @file OverviewRecent.vue @description 管理概览的最近编辑：六域最近更新的十二项，标注状态、所属模块与时间 -->
<template>
  <section class="admin-card" aria-labelledby="overview-recent">
    <h2 id="overview-recent">{{ t('admin-system.overview.recentTitle') }}</h2>
    <p v-if="items === null" role="alert">
      {{ t('admin-system.overview.recentUnavailable')
      }}<button type="button" :disabled="pending" @click="$emit('reload')">
        {{ t('admin-system.overview.reloadRecent') }}
      </button>
    </p>
    <p v-else-if="!items.length">{{ t('admin-system.overview.recentEmpty') }}</p>
    <ul v-else class="overview__recent">
      <li v-for="item in items" :key="item.domain + ':' + item.id">
        <NuxtLink :to="overviewEditorPath(item)">{{ item.title }}</NuxtLink>
        <span
          ><span class="overview__status" :class="`is-${item.status}`">{{
            t(`admin-system.overview.status.${item.status}`)
          }}</span>
          {{ t(`admin-system.overview.domains.${item.domain}`) }} · {{ formatTime(item.updatedAt) }}</span
        >
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { overviewEditorPath } from '~/features/admin/overview'
import type { OverviewContent } from '~/features/admin/types'

defineProps<{ items: OverviewContent[] | null; pending: boolean }>()
defineEmits<{ reload: [] }>()
const { t } = useI18n()
function formatTime(value: string) {
  return formatDateTime(value, { hour12: false })
}
</script>

<style scoped lang="scss">
.overview__recent {
  margin: 0;
  padding: 0;
  list-style: none;

  li {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    padding: 0.625rem 0;
    border-bottom: 1px solid var(--border-soft);

    &:last-child {
      border-bottom: 0;
    }
    a {
      overflow: hidden;
      color: var(--text-main);
      font-size: 0.875rem;
      font-weight: 500;
      text-decoration: none;
      text-overflow: ellipsis;
      white-space: nowrap;

      &:hover {
        color: var(--accent-text);
      }
    }
    > span {
      color: var(--text-soft);
      font-size: 0.75rem;
    }
  }
}
.overview__status {
  display: inline-block;
  margin-right: 0.25rem;
  padding: 0 0.375rem;
  border-radius: 0.25rem;
  background: var(--surface-3);
  color: var(--text-muted);
  font-weight: 500;

  &.is-published {
    background: color-mix(in srgb, var(--success-text) 14%, transparent);
    color: var(--success-text);
  }
  &.is-draft {
    background: color-mix(in srgb, var(--warning-text) 14%, transparent);
    color: var(--warning-text);
  }
}
</style>
