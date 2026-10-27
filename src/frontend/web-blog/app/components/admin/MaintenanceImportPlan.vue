<!-- @file MaintenanceImportPlan.vue @description 导入票据的计划部分：各内容域数量、跳过与媒体统计、计划错误和逐项原因。 -->
<template>
  <p>
    {{
      t('admin-system.maintenance.job.planCore', {
        posts: job.plan.counts.posts,
        flashes: job.plan.counts.flashes,
        moments: job.plan.counts.moments ?? 0,
        comments: job.plan.counts.comments,
        skipped: job.plan.counts.skipped,
      })
    }}
  </p>
  <p>{{ t('admin-system.maintenance.job.planGuestbook', { count: job.plan.counts.guestbook ?? 0 }) }}</p>
  <p>{{ t('admin-system.maintenance.job.planGallery', { count: job.plan.counts.gallery ?? 0 }) }}</p>
  <p>{{ t('admin-system.maintenance.job.planProjects', { count: job.plan.counts.projects ?? 0 }) }}</p>
  <p>{{ t('admin-system.maintenance.job.planLinks', { count: job.plan.counts.links ?? 0 }) }}</p>
  <p>{{ t('admin-system.maintenance.job.planPrompts', { count: job.plan.counts.prompts ?? 0 }) }}</p>
  <p>{{ t('admin-system.maintenance.job.planSubscriptions', { count: job.plan.counts.subscriptions ?? 0 }) }}</p>
  <p>
    {{ t('admin-system.maintenance.job.planMedia', { media: job.plan.counts.media, files: job.plan.counts.files }) }}
  </p>
  <p>{{ t('admin-system.maintenance.job.relationsNote') }}</p>
  <p v-if="job.plan.omittedRelations" role="status">
    {{ t('admin-system.maintenance.job.omittedRelations', { count: job.plan.omittedRelations }) }}
  </p>
  <p v-if="job.error" role="alert">{{ job.error }}</p>
  <p v-if="job.expired">{{ t('admin-system.maintenance.job.expired') }}</p>
  <ul>
    <li v-for="issue in job.plan.errors" :key="issue">{{ issue }}</li>
  </ul>
  <details>
    <summary>{{ t('admin-system.maintenance.job.itemsSummary') }}</summary>
    <ul>
      <li v-for="post in job.plan.posts" :key="`post-${post.sourceId}`">
        {{ post.title }} · {{ post.reason
        }}{{ post.slug ? t('admin-system.maintenance.job.slugSuffix', { slug: post.slug }) : '' }}
      </li>
      <li v-for="flash in job.plan.flashes" :key="flash.sourceId">{{ flash.title }} · {{ flash.reason }}</li>
      <li v-for="moment in job.plan.moments ?? []" :key="`moment-${moment.sourceId}`">
        {{ moment.title }} · {{ moment.reason }}
      </li>
      <li v-for="message in job.plan.guestbook ?? []" :key="`guestbook-${message.sourceId}`">
        {{ message.title }} · {{ message.reason }}
      </li>
      <li v-for="photo in job.plan.gallery ?? []" :key="`gallery-${photo.sourceId}`">
        {{ photo.title }} · {{ photo.reason }}
      </li>
      <li v-for="project in job.plan.projects ?? []" :key="`project-${project.sourceId}`">
        {{ project.title }} · {{ project.reason }}
      </li>
      <li v-for="subscription in job.plan.subscriptions ?? []" :key="`subscription-${subscription.sourceId}`">
        {{
          t('admin-system.maintenance.job.subscriptionItem', {
            title: subscription.title,
            reason: subscription.reason,
          })
        }}
      </li>
      <li v-for="prompt in job.plan.prompts ?? []" :key="`prompt-${prompt.sourceId}`">
        {{ t('admin-system.maintenance.job.promptItem', { title: prompt.title, reason: prompt.reason }) }}
      </li>
      <li v-for="link in job.plan.links ?? []" :key="`link-${link.sourceId}`">{{ link.title }} · {{ link.reason }}</li>
    </ul>
  </details>
</template>
<script setup lang="ts">
import type { ContentImportView } from '~/features/backup/types'

defineProps<{ job: ContentImportView }>()
const { t } = useI18n()
</script>
<style scoped lang="scss">
@use '~/assets/styles/admin-maintenance' as maintenance;

@include maintenance.page;
</style>
