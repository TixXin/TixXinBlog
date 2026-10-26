<!--
  @file taxonomy.vue
  @description 专栏与标签真实管理，展示全状态引用并防止误删；页面只组装编辑器与分组，流程见 useAdminTaxonomy。
-->
<template>
  <section class="taxonomy">
    <header class="admin-page-header">
      <div>
        <h1>{{ t('admin-content.taxonomy.title') }}</h1>
        <p class="taxonomy__intro">{{ t('admin-content.taxonomy.intro') }}</p>
      </div>
    </header>
    <ClientOnly>
      <p v-if="pending" role="status">{{ t('admin-content.taxonomy.loading') }}</p>
      <p v-if="error" role="alert">
        {{ error }}
        <button type="button" :disabled="working || pending" @click="load">
          {{ t('admin-content.taxonomy.reload') }}
        </button>
      </p>
      <div v-if="data" class="taxonomy__types">
        <span>{{ t('admin-content.taxonomy.techCount', { count: taxonomyCategoryCount(data, 'tech') }) }}</span
        ><span>{{ t('admin-content.taxonomy.lifeCount', { count: taxonomyCategoryCount(data, 'life') }) }}</span>
      </div>
      <AdminTaxonomyEditor
        ref="editorForm"
        v-model:kind="kind"
        v-model:label="label"
        v-model:color="color"
        :editing-id="editingId"
        :working="working"
        :pending="pending"
        :ready="ready"
        :saving="saving"
        :colors="colors"
        @save="save"
        @cancel="resetEditor"
      />
      <template v-if="data">
        <AdminTaxonomyGroup
          v-for="group in groups"
          :key="group.kind"
          :group="group"
          :working="working"
          @edit="(item) => edit(group.kind, item, focusName)"
          @remove="(item) => remove(group.kind, item)"
        />
      </template>
    </ClientOnly>
  </section>
</template>
<script setup lang="ts">
import { taxonomyCategoryCount } from '~/features/post/adminTaxonomy'
import { useAdminTaxonomy } from '~/features/post/useAdminTaxonomy'

definePageMeta({ layout: 'admin' })
const { t } = useI18n()
useSeoMeta({ title: () => t('admin-content.taxonomy.title'), robots: 'noindex, nofollow' })
const { data, pending, ready, working, saving, error, colors, groups, kind, label, color, editingId, ...actions } =
  useAdminTaxonomy()
const { load, save, edit, remove, resetEditor } = actions
const editorForm = ref<{ focusName: () => void } | null>(null)
const focusName = () => editorForm.value?.focusName()
</script>
<style scoped lang="scss">
@use '~/assets/styles/admin-taxonomy' as taxonomy;

.taxonomy {
  min-width: 0;
  overflow-wrap: anywhere;
}
.taxonomy__intro {
  @include taxonomy.hint;
}
.taxonomy__types {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
  margin: 1.5rem 0;
}
</style>
