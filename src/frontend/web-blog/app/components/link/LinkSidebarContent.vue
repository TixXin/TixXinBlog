<!-- @file LinkSidebarContent.vue @description 友链统计、申请规则与本站资料的侧栏/折叠内容组合 -->
<template>
  <CommonRequestFeedback
    v-if="pending || error"
    :pending="pending"
    :compact="!!metadata"
    :title="metadataFeedbackTitle"
    :description="metadataFeedbackDescription"
    @retry="emit('retryMetadata')"
  />
  <LinkStats v-if="metadata" :stats="metadata.stats" />
  <LinkRules v-if="metadata" :rules="metadata.rules" />
  <LinkSiteInfoCard
    :info="site.info.value"
    :ready="site.ready.value"
    :pending="site.pending.value"
    :error="site.error.value"
    :copying="site.copying.value"
    :copy-error="site.copyError.value"
    :notice="site.notice.value"
    :retained-text="site.retainedText.value"
    @retry="site.refresh"
    @copy="site.copy"
  />
</template>

<script setup lang="ts">
import type { LinkMetadata } from '~/features/link/types'

const props = defineProps<{
  metadata?: LinkMetadata | null
  pending: boolean
  error?: Error | null
  site: ReturnType<typeof useLinkSiteInfo>
}>()

const emit = defineEmits<{
  (e: 'retryMetadata'): void
}>()

const { t } = useI18n()

// 失败用稳定标题；具体原因放在说明里，有旧资料时同时说明仍在显示
const metadataFeedbackTitle = computed(() =>
  props.error ? t('interaction.links.metadataUnavailable') : t('interaction.links.metadataLoading'),
)

const metadataFeedbackDescription = computed(() => {
  if (!props.error) return undefined
  const message = props.error.message
  return props.metadata ? t('interaction.links.metadataStale', { message }) : message
})
</script>
