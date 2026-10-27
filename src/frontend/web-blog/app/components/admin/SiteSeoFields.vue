<!--
  @file SiteSeoFields.vue
  @description 站点设置的公告与搜索：站点公告、SEO 标题与描述、搜索引擎收录开关
-->
<template>
  <fieldset :disabled="disabled">
    <legend>{{ t('admin-system.site.page.seoLegend') }}</legend>
    <label
      >{{ t('admin-system.site.editor.fields.announcement')
      }}<textarea
        v-model="draft.announcement"
        maxlength="1000"
        rows="4"
        :placeholder="t('admin-system.site.page.announcementPlaceholder')"
      />
    </label>
    <label
      >{{ t('admin-system.site.editor.fields.seoTitle')
      }}<input v-model="draft.seoTitle" maxlength="160" :placeholder="t('admin-system.site.page.seoTitlePlaceholder')"
    /></label>
    <label
      >{{ t('admin-system.site.editor.fields.seoDescription')
      }}<textarea
        v-model="draft.seoDescription"
        maxlength="320"
        rows="3"
        :placeholder="t('admin-system.site.page.seoDescriptionPlaceholder')"
      />
    </label>
    <label class="admin-site__check"
      ><input
        v-model="draft.searchIndexing"
        class="admin-switch"
        type="checkbox"
        aria-describedby="admin-site-indexing-hint"
      />{{ t('admin-system.site.page.searchIndexing') }}</label
    >
    <p id="admin-site-indexing-hint" class="admin-site__hint">
      {{ t('admin-system.site.page.searchIndexingHint') }}
    </p>
  </fieldset>
</template>
<script setup lang="ts">
import type { SiteSettingsData } from '~/features/site/settings'

defineProps<{ disabled: boolean }>()
const draft = defineModel<SiteSettingsData>({ required: true })
const { t } = useI18n()
</script>
<style scoped lang="scss">
@use '~/assets/styles/admin-site' as site;

@include site.page;
</style>
