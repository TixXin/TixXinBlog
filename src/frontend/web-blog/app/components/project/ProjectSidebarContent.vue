<!-- @file ProjectSidebarContent.vue @description 项目技术分布与统计指标的侧栏/折叠内容组合 -->
<template>
  <CommonRequestFeedback
    v-if="pending || error"
    :pending="pending"
    :compact="!!metadata"
    :title="metadataFeedbackTitle"
    :description="metadataFeedbackDescription"
    @retry="emit('retryMetadata')"
  />
  <ProjectStats v-if="metadata" :stats="stats" />
  <ProjectTechStackCard v-if="metadata" :stack="metadata.tags" :interactive="interactive" @tag="emit('tag', $event)" />
</template>

<script setup lang="ts">
import type { ProjectMetadata } from '~/features/project/types'

const props = defineProps<{
  metadata?: ProjectMetadata | null
  pending: boolean
  error?: Error | null
  interactive: boolean
}>()

const emit = defineEmits<{
  (e: 'retryMetadata'): void
  (e: 'tag', tag: string): void
}>()

const { t } = useI18n()

// 失败用稳定标题；具体原因放在说明里，有旧统计时同时说明仍在显示
const metadataFeedbackTitle = computed(() =>
  props.error ? t('misc.project.metadata.unavailable') : t('misc.project.metadata.loading'),
)

const metadataFeedbackDescription = computed(() => {
  if (!props.error) return undefined
  const message = props.error.message
  return props.metadata ? t('misc.project.metadata.staleDescription', { message }) : message
})

const stats = computed(() =>
  props.metadata
    ? [
        { label: t('misc.project.stats.projects'), value: String(props.metadata.stats.projects) },
        { label: t('misc.project.stats.active'), value: String(props.metadata.stats.active) },
        { label: t('misc.project.stats.dev'), value: String(props.metadata.stats.dev) },
        { label: t('misc.project.stats.archived'), value: String(props.metadata.stats.archived) },
        { label: t('misc.project.stats.tags'), value: String(props.metadata.stats.tags) },
      ]
    : [],
)
</script>
