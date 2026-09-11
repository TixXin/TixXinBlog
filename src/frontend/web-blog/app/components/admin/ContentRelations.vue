<!-- @file ContentRelations.vue @description 有向关联纯展示表单；选择、排序和移除均由父级接入原编辑保护。 -->
<template>
  <section class="content-relations" aria-label="关联内容" :aria-busy="pending || resolving">
    <h2>关联内容（{{ selected.length }} / 12）</h2>
    <p>从当前内容指向下列目标，按这里的顺序展示；不会自动反向关联。访客只看到已公开目标。</p>
    <p v-if="resolveError" role="alert">{{ resolveError }}</p>
    <p v-if="resolving" aria-live="polite">正在核查已选目标…</p>
    <ol v-if="selected.length">
      <li v-for="(item, index) in selected" :key="item.type + ':' + item.id">
        <span
          >{{ contentRelationLabels[item.type] }} #{{ item.id }} · {{ item.title }} ·
          {{ contentRelationStatuses[item.status] ?? item.status }}</span
        >
        <div class="content-relations__actions">
          <button
            type="button"
            :disabled="disabled || index === 0"
            :aria-label="`上移关联 ${index + 1}`"
            @click="$emit('move', index, -1)"
          >
            上移
          </button>
          <button
            type="button"
            :disabled="disabled || index === selected.length - 1"
            :aria-label="`下移关联 ${index + 1}`"
            @click="$emit('move', index, 1)"
          >
            下移
          </button>
          <button
            type="button"
            :disabled="disabled"
            :aria-label="`解除关联 ${index + 1}`"
            @click="$emit('remove', index)"
          >
            解除关联
          </button>
        </div>
      </li>
    </ol>
    <p v-else>尚未关联其他内容。</p>
    <button v-if="selected.length" type="button" :disabled="disabled || resolving" @click="$emit('resolve')">
      刷新关联状态
    </button>
    <div class="content-relations__search">
      <label
        >目标类型<select
          :value="type"
          aria-label="关联目标类型"
          :disabled="disabled"
          @change="$emit('type', ($event.target as HTMLSelectElement).value as ContentRelationType)"
        >
          <option v-for="(label, key) in contentRelationLabels" :key="key" :value="key">{{ label }}</option>
        </select></label
      >
      <label
        >按标题查找<input
          :value="q"
          aria-label="查找关联内容"
          maxlength="200"
          :disabled="disabled"
          @input="$emit('query', ($event.target as HTMLInputElement).value)"
          @keydown.enter.prevent="$emit('search')"
      /></label>
      <button type="button" :disabled="disabled || pending" @click="$emit('search')">查找内容</button>
    </div>
    <p v-if="error" role="alert">
      {{ error }} <button type="button" :disabled="disabled || pending" @click="$emit('search')">重试查找</button>
    </p>
    <p v-if="pending" aria-live="polite">正在查找内容…</p>
    <ul v-else-if="candidates.length" class="content-relations__candidates">
      <li v-for="item in candidates" :key="item.type + ':' + item.id">
        <span>{{ item.title }} · {{ contentRelationStatuses[item.status] ?? item.status }}</span>
        <button
          type="button"
          :disabled="disabled || item.disabled"
          :aria-label="`关联${contentRelationLabels[item.type]}：${item.title}`"
          @click="$emit('choose', item)"
        >
          添加关联
        </button>
      </li>
    </ul>
    <p v-else-if="!error && total !== null">未找到可选择的内容。</p>
    <nav v-if="total !== null && total > 12" class="content-relations__actions" aria-label="关联候选分页">
      <button type="button" :disabled="disabled || pending || page <= 1" @click="$emit('page', page - 1)">
        上一页
      </button>
      <span>{{ page }} / {{ Math.ceil(total / 12) }} · {{ total }} 项</span>
      <button type="button" :disabled="disabled || pending || page * 12 >= total" @click="$emit('page', page + 1)">
        下一页
      </button>
    </nav>
  </section>
</template>
<script setup lang="ts">
import { contentRelationLabels, contentRelationStatuses } from '~/features/content-relation/types'
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
