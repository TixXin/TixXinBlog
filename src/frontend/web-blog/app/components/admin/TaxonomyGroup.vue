<!-- @file TaxonomyGroup.vue @description 专栏或标签分组：标题与数量、删除规则提示、空状态与可键盘横向滚动的引用表格。 -->
<template>
  <section class="taxonomy__group" :aria-label="group.title">
    <h2>{{ t('admin-content.taxonomy.group.heading', { title: group.title, count: group.items.length }) }}</h2>
    <p>{{ t('admin-content.taxonomy.group.hint') }}</p>
    <p v-if="!group.items.length">{{ group.empty }}</p>
    <div
      v-else
      class="taxonomy__table"
      role="region"
      :aria-label="t('admin-content.taxonomy.group.table', { title: group.title })"
      tabindex="0"
    >
      <table>
        <thead>
          <tr>
            <th>{{ t('admin-content.taxonomy.columns.name') }}</th>
            <th>{{ t('admin-content.taxonomy.columns.total') }}</th>
            <th>{{ t('admin-content.taxonomy.columns.published') }}</th>
            <th>{{ t('admin-content.taxonomy.columns.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <AdminTaxonomyRow
            v-for="item in group.items"
            :key="item.id"
            :kind="group.kind"
            :item="item"
            :working="working"
            @edit="emit('edit', item)"
            @remove="emit('remove', item)"
          />
        </tbody>
      </table>
    </div>
  </section>
</template>
<script setup lang="ts">
import type { AdminTaxonomyGroup, AdminTaxonomyItem } from '~/features/post/adminTaxonomy'

defineProps<{ group: AdminTaxonomyGroup; working: boolean }>()
const emit = defineEmits<{ edit: [item: AdminTaxonomyItem]; remove: [item: AdminTaxonomyItem] }>()
const { t } = useI18n()
</script>
<style scoped lang="scss">
@use '~/assets/styles/admin-taxonomy' as taxonomy;

h2 {
  @include taxonomy.heading;
}
.taxonomy__group > p {
  @include taxonomy.hint;
}
.taxonomy__group {
  @include taxonomy.card;
}
.taxonomy__table {
  min-width: 0;
  max-width: 100%;
  overflow-x: auto;
}
.taxonomy__table:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}
table {
  width: 100%;
  border-collapse: collapse;
}
th {
  @include taxonomy.cell;
}
@media (max-width: 600px) {
  .taxonomy__group {
    @include taxonomy.card-narrow;
  }
}
</style>
