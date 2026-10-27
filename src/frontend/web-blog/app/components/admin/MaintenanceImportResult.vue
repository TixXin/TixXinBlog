<!-- @file MaintenanceImportResult.vue @description 导入票据的执行结果：迁入数量、关联写入与各内容域的检查入口。 -->
<template>
  <p role="status">
    {{
      t('admin-system.maintenance.job.resultCore', {
        posts: result.posts.length,
        flashes: result.flashes.length,
        moments: result.moments?.length ?? 0,
        comments: result.comments,
      })
    }}
  </p>
  <p>{{ t('admin-system.maintenance.job.resultGuestbook', { count: result.guestbook?.length ?? 0 }) }}</p>
  <p>{{ t('admin-system.maintenance.job.resultGallery', { count: result.gallery?.length ?? 0 }) }}</p>
  <p>{{ t('admin-system.maintenance.job.resultProjects', { count: result.projects?.length ?? 0 }) }}</p>
  <p>{{ t('admin-system.maintenance.job.resultPrompts', { count: result.prompts?.length ?? 0 }) }}</p>
  <p>
    {{ t('admin-system.maintenance.job.resultSubscriptions', { count: result.subscriptions?.length ?? 0 }) }}
  </p>
  <p>{{ t('admin-system.maintenance.job.resultLinks', { count: result.links?.length ?? 0 }) }}</p>
  <p v-if="result.relations">
    {{
      t('admin-system.maintenance.job.resultRelations', {
        applied: result.relations.applied,
        omitted: result.relations.omitted,
      })
    }}
  </p>
  <ul>
    <li v-for="post in result.posts" :key="post.id">
      <NuxtLink :to="`/admin/posts/${post.id}`">{{
        t('admin-system.maintenance.job.checkPost', { id: post.id })
      }}</NuxtLink
      >{{ t('admin-system.maintenance.job.postSource', { id: post.sourceId }) }}
    </li>
  </ul>
  <NuxtLink v-if="result.flashes.length" to="/admin/flashes?status=draft">{{
    t('admin-system.maintenance.job.checkFlashes')
  }}</NuxtLink>
  <NuxtLink v-if="result.moments?.length" to="/admin/moments?status=draft">{{
    t('admin-system.maintenance.job.checkMoments')
  }}</NuxtLink>
  <NuxtLink v-if="result.guestbook?.length" to="/admin/guestbook">{{
    t('admin-system.maintenance.job.checkGuestbook')
  }}</NuxtLink>
  <NuxtLink v-if="result.gallery?.length" to="/admin/gallery?status=draft">{{
    t('admin-system.maintenance.job.checkGallery')
  }}</NuxtLink>
  <NuxtLink v-if="result.projects?.length" to="/admin/projects?status=draft">{{
    t('admin-system.maintenance.job.checkProjects')
  }}</NuxtLink>
  <NuxtLink v-if="result.subscriptions?.length" to="/admin/subscriptions?status=draft">{{
    t('admin-system.maintenance.job.checkSubscriptions')
  }}</NuxtLink>
  <NuxtLink v-if="result.prompts?.length" to="/prompts?view=manage">{{
    t('admin-system.maintenance.job.checkPrompts')
  }}</NuxtLink>
  <NuxtLink v-if="result.links?.length" to="/admin/links?status=draft">{{
    t('admin-system.maintenance.job.checkLinks')
  }}</NuxtLink>
</template>
<script setup lang="ts">
import type { ContentImportView } from '~/features/backup/types'

defineProps<{ result: NonNullable<ContentImportView['result']> }>()
const { t } = useI18n()
</script>
<style scoped lang="scss">
@use '~/assets/styles/admin-maintenance' as maintenance;

@include maintenance.page;
</style>
