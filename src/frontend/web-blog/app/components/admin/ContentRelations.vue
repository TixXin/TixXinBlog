<!-- @file ContentRelations.vue @description 有向关联纯展示表单；选择、排序和移除均由父级接入原编辑保护。 -->
<template>
  <section class="content-relations" :aria-label="t('admin-system.relations.label')" :aria-busy="pending || resolving">
    <h2>{{ t('admin-system.relations.title', { count: selected.length, max: 12 }) }}</h2>
    <p>{{ t('admin-system.relations.intro') }}</p>
    <p v-if="resolveError" role="alert">{{ resolveError }}</p>
    <p v-if="resolving" aria-live="polite">{{ t('admin-system.relations.resolving') }}</p>
    <ol v-if="selected.length">
      <li v-for="(item, index) in selected" :key="item.type + ':' + item.id">
        <span>{{ typeLabel(item.type) }} #{{ item.id }} · {{ item.title }} · {{ statusLabel(item.status) }}</span>
        <div class="content-relations__actions">
          <button
            type="button"
            :disabled="disabled || index === 0"
            :aria-label="t('admin-system.relations.moveUpLabel', { index: index + 1 })"
            @click="$emit('move', index, -1)"
          >
            {{ t('admin-system.relations.moveUp') }}
          </button>
          <button
            type="button"
            :disabled="disabled || index === selected.length - 1"
            :aria-label="t('admin-system.relations.moveDownLabel', { index: index + 1 })"
            @click="$emit('move', index, 1)"
          >
            {{ t('admin-system.relations.moveDown') }}
          </button>
          <button
            type="button"
            :disabled="disabled"
            :aria-label="t('admin-system.relations.removeLabel', { index: index + 1 })"
            @click="$emit('remove', index)"
          >
            {{ t('admin-system.relations.remove') }}
          </button>
        </div>
      </li>
    </ol>
    <p v-else>{{ t('admin-system.relations.empty') }}</p>
    <button v-if="selected.length" type="button" :disabled="disabled || resolving" @click="$emit('resolve')">
      {{ t('admin-system.relations.resolve') }}
    </button>
    <div class="content-relations__search">
      <label
        >{{ t('admin-system.relations.type')
        }}<select
          :value="type"
          :aria-label="t('admin-system.relations.typeLabel')"
          :disabled="disabled"
          @change="$emit('type', ($event.target as HTMLSelectElement).value as ContentRelationType)"
        >
          <option v-for="key in relationTypes" :key="key" :value="key">{{ typeLabel(key) }}</option>
        </select></label
      >
      <label
        >{{ t('admin-system.relations.query')
        }}<input
          :value="q"
          :aria-label="t('admin-system.relations.queryLabel')"
          maxlength="200"
          :disabled="disabled"
          @input="$emit('query', ($event.target as HTMLInputElement).value)"
          @keydown.enter.prevent="$emit('search')"
      /></label>
      <button type="button" :disabled="disabled || pending" @click="$emit('search')">
        {{ t('admin-system.relations.search') }}
      </button>
    </div>
    <p v-if="error" role="alert">
      {{ error }}
      <button type="button" :disabled="disabled || pending" @click="$emit('search')">
        {{ t('admin-system.relations.retrySearch') }}
      </button>
    </p>
    <p v-if="pending" aria-live="polite">{{ t('admin-system.relations.searching') }}</p>
    <ul v-else-if="candidates.length" class="content-relations__candidates">
      <li v-for="item in candidates" :key="item.type + ':' + item.id">
        <span>{{ item.title }} · {{ statusLabel(item.status) }}</span>
        <button
          type="button"
          :disabled="disabled || item.disabled"
          :aria-label="t('admin-system.relations.chooseLabel', { type: typeLabel(item.type), title: item.title })"
          @click="$emit('choose', item)"
        >
          {{ t('admin-system.relations.choose') }}
        </button>
      </li>
    </ul>
    <p v-else-if="!error && total !== null">{{ t('admin-system.relations.noCandidates') }}</p>
    <nav
      v-if="total !== null && total > 12"
      class="content-relations__actions"
      :aria-label="t('admin-system.relations.pagination')"
    >
      <button type="button" :disabled="disabled || pending || page <= 1" @click="$emit('page', page - 1)">
        {{ t('admin-system.operations.prev') }}
      </button>
      <span
        >{{ page }} / {{ Math.ceil(total / 12) }} ·
        {{ t('admin-system.relations.total', { count: total }, total) }}</span
      >
      <button type="button" :disabled="disabled || pending || page * 12 >= total" @click="$emit('page', page + 1)">
        {{ t('admin-system.operations.next') }}
      </button>
    </nav>
  </section>
</template>
<script setup lang="ts">
import type { ContentRelation, ContentRelationType, ManagedContentRelation } from '~/features/content-relation/types'
defineProps<{
  selected: ManagedContentRelation[]
  candidates: (ManagedContentRelation & { disabled: boolean })[]
  type: ContentRelationType
  q: string
  page: number
  total: number | null
  pending: boolean
  resolving: boolean
  error: string
  resolveError: string
  disabled: boolean
}>()
defineEmits<{
  choose: [value: ContentRelation]
  remove: [index: number]
  move: [index: number, offset: number]
  search: []
  page: [page: number]
  type: [type: ContentRelationType]
  query: [q: string]
  resolve: []
}>()
const { t } = useI18n()
const relationTypes: ContentRelationType[] = ['post', 'project', 'gallery']
// 有字典名称的关联状态，未知状态原样显示
const statuses = ['published', 'draft', 'archived', 'withdrawn', 'deleted', 'missing', 'unknown']
const typeLabel = (type: ContentRelationType) => t(`admin-system.relations.types.${type}`)
const statusLabel = (status: string) =>
  statuses.includes(status) ? t(`admin-system.relations.statuses.${status}`) : status
</script>
<style scoped lang="scss">
.content-relations {
  min-width: 0;
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  margin: 1rem 0;
}
h2 {
  font-size: 1.1rem;
  font-weight: 600;
}
p {
  margin: 0.65rem 0;
  color: var(--text-muted);
}
ol,
ul {
  padding-left: 1.25rem;
}
li {
  margin: 0.6rem 0;
  overflow-wrap: anywhere;
}
.content-relations__search,
.content-relations__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
}
label {
  display: grid;
  gap: 0.3rem;
  min-width: 0;
  max-width: 100%;
}
input,
select,
button {
  min-height: 44px;
  max-width: 100%;
  padding: 0.45rem 0.65rem;
  border: 1px solid var(--border);
  border-radius: 0.4rem;
  background: var(--surface-2);
  color: var(--text-main);
}
input {
  min-width: 0;
}
.content-relations__candidates {
  max-height: 22rem;
  overflow: auto;
}
.content-relations__candidates li {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: space-between;
  align-items: center;
}
:disabled {
  opacity: 0.5;
}
</style>
