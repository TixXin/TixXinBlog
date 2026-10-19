<!--
  @file audit.vue
  @description 管理操作只读审计：按操作、结果和 UTC 日期检索。
-->
<template>
  <section class="admin-audit">
    <h1>{{ t('admin-system.audit.title') }}</h1>
    <p>{{ t('admin-system.audit.intro') }}</p>
    <ClientOnly>
      <form class="admin-audit__filters" @submit.prevent="navigate(1)">
        <label
          >{{ t('admin-system.audit.actionFilter')
          }}<select v-model="action">
            <option value="">{{ t('admin-system.audit.allActions') }}</option>
            <option v-for="(label, key) in actions" :key="key" :value="key">{{ label }}</option>
          </select></label
        >
        <label
          >{{ t('admin-system.audit.stateFilter')
          }}<select v-model="state">
            <option value="">{{ t('admin-system.audit.allStates') }}</option>
            <option v-for="key in auditStates" :key="key" :value="key">
              {{ t(`admin-system.audit.states.${key}`) }}
            </option>
          </select></label
        >
        <label>{{ t('admin-system.audit.from') }}<input v-model="from" type="date" /></label
        ><label>{{ t('admin-system.audit.to') }}<input v-model="to" type="date" /></label>
        <button :aria-busy="pending" type="submit" :disabled="pending">{{ t('admin-system.audit.submit') }}</button
        ><button type="button" :disabled="pending" @click="clear">{{ t('admin-system.audit.clear') }}</button
        ><button type="button" :disabled="pending" @click="load">{{ t('admin-system.audit.refresh') }}</button>
      </form>
      <p v-if="actionsError" role="alert">
        {{ actionsError }}
        <button type="button" @click="loadActions">{{ t('admin-system.audit.retryActions') }}</button>
      </p>
      <p v-if="!error && (health.waitingResults || health.retryQueue || health.droppedRetries)" role="status">
        {{ t('admin-system.audit.health', { waiting: health.waitingResults, queued: health.retryQueue })
        }}{{ health.droppedRetries ? t('admin-system.audit.healthDropped') : '' }}
      </p>
      <p v-if="pending" role="status">{{ t('admin-system.audit.loading') }}</p>
      <p v-if="error" role="alert">{{ error }}</p>
      <AdminAuditLog :items="items" />
      <p v-if="!pending && !error && !items.length">{{ t('admin-system.audit.empty') }}</p>
      <nav class="admin-audit__pagination" :aria-label="t('admin-system.audit.pagination')">
        <button type="button" :disabled="pending || page <= 1" @click="navigate(page - 1)">
          {{ t('admin-system.audit.prev') }}</button
        ><span>
          {{ page }} / {{ Math.max(1, Math.ceil(total / 20)) }} ·
          {{ t('admin-system.audit.total', { count: total }, total) }} </span
        ><button type="button" :disabled="pending || page * 20 >= total" @click="navigate(page + 1)">
          {{ t('admin-system.audit.next') }}
        </button>
      </nav>
    </ClientOnly>
  </section>
</template>
<script setup lang="ts">
import { auditStates } from '~/features/audit/types'
definePageMeta({ layout: 'admin', key: '/admin/audit' })
const { t } = useI18n()
useSeoMeta({ title: () => t('admin-system.audit.title'), robots: 'noindex, nofollow' })
const {
  items,
  total,
  page,
  action,
  state,
  from,
  to,
  actions,
  actionsError,
  loadActions,
  pending,
  error,
  health,
  navigate,
  load,
  clear,
} = useAuditLogs()
</script>
<style scoped>
.admin-audit {
  min-width: 0;
  overflow-wrap: anywhere;
}
.admin-audit__pagination {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}
h1 {
  font-size: 1.6rem;
}
p {
  margin-block: 0.75rem;
  color: var(--text-muted);
}
.admin-audit__filters {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 0.75rem;
  margin-block: 1rem;
}
label {
  display: grid;
  min-width: 0;
  gap: 0.5rem;
}
button,
select,
input {
  background: var(--surface-2);
  color: var(--text-main);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  padding: 0.6rem;
  max-width: 100%;
  min-width: 0;
  min-height: 44px;
  box-sizing: border-box;
}
button:disabled {
  opacity: 0.5;
}
@media (max-width: 640px) {
  .admin-audit__filters > label {
    flex: 1 1 100%;
  }
  .admin-audit__filters input,
  .admin-audit__filters select {
    width: 100%;
  }
}
</style>
