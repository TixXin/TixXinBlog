<!-- @file LinkRecoveryDetails.vue @description 友链恢复副本完整只读显示，不自动访问旧URL或绑定旧Logo -->
<template>
  <dl class="recovery-details">
    <dt>{{ $t('admin-media.linkForm.name') }}</dt>
    <dd>{{ value.name || $t('admin-media.galleryForm.notFilled') }}</dd>
    <dt>{{ $t('admin-media.linkForm.description') }}</dt>
    <dd>{{ value.description || $t('admin-media.galleryForm.notFilled') }}</dd>
    <dt>{{ $t('admin-media.linkForm.url') }}</dt>
    <dd>{{ value.url || $t('admin-media.galleryForm.notFilled') }}</dd>
    <dt>{{ $t('admin-media.linkForm.statusFeaturedSort') }}</dt>
    <dd>
      {{ linkStatusLabel(value.status, t) }} /
      {{ value.isFeatured ? $t('admin-media.linkList.featured') : $t('admin-media.linkList.notFeatured') }} /
      {{ value.sortOrder }}
    </dd>
    <dt>{{ $t('admin-media.linkForm.logoMediaId') }}</dt>
    <dd>{{ value.logoMediaId || $t('admin-media.linkForm.notSet') }}</dd>
    <dt>{{ $t('admin-media.linkForm.originalLogoUrl') }}</dt>
    <dd>{{ value.logoUrl || $t('admin-media.linkForm.notSet') }}</dd>
    <dd>{{ $t('admin-media.linkForm.logoRebind') }}</dd>
  </dl>
</template>
<script setup lang="ts">
import { linkStatusLabel } from '~/features/link/types'
import type { LinkEditable } from '~/features/link/types'
defineProps<{ value: LinkEditable }>()
const { t } = useI18n()
</script>
<style scoped>
.recovery-details {
  display: grid;
  gap: 0.35rem;
  overflow-wrap: anywhere;
}
dt {
  font-weight: 600;
  margin-top: 0.5rem;
}
dd {
  margin: 0;
  color: var(--text-muted);
  white-space: pre-wrap;
}
</style>
