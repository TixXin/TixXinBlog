<!-- @file TaxonomyRow.vue @description 专栏或标签表格的一行：名称、引用计数、查看文章、编辑与仍有引用时禁用的删除。 -->
<template>
  <tr>
    <td>{{ item.label }}</td>
    <td>{{ item.total }}</td>
    <td>{{ item.published }}</td>
    <td>
      <NuxtLink :to="taxonomyPostsLocation(kind, item.label)">{{ t('admin-content.taxonomy.viewPosts') }}</NuxtLink>
      <button type="button" :disabled="working" @click="emit('edit')">
        {{ t('admin-content.taxonomy.edit') }}
      </button>
      <button
        type="button"
        :disabled="working || item.total > 0"
        :title="t(item.total ? 'admin-content.taxonomy.deleteBlocked' : 'admin-content.taxonomy.deleteHint')"
        @click="emit('remove')"
      >
        {{ t('admin-content.taxonomy.delete') }}
      </button>
    </td>
  </tr>
</template>
<script setup lang="ts">
import { taxonomyPostsLocation } from '~/features/post/adminTaxonomy'
import type { AdminTaxonomyItem, AdminTaxonomyKind } from '~/features/post/adminTaxonomy'

defineProps<{ kind: AdminTaxonomyKind; item: AdminTaxonomyItem; working: boolean }>()
const emit = defineEmits<{ edit: []; remove: [] }>()
const { t } = useI18n()
</script>
<style scoped lang="scss">
@use '~/assets/styles/admin-taxonomy' as taxonomy;

td button {
  margin-left: 0.6rem;
}
a:not(.admin-btn) {
  color: var(--accent);
}
td {
  @include taxonomy.cell;
}
</style>
