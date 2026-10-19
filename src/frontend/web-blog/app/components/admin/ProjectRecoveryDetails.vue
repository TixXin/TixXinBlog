<!-- @file ProjectRecoveryDetails.vue @description 项目恢复副本完整只读字段，旧封面只展示编号供重新选择 -->
<template>
  <dl class="recovery-details">
    <dt>{{ $t('admin-media.projectRecovery.title') }}</dt>
    <dd>{{ value.title || $t('admin-media.projectRecovery.empty') }}</dd>
    <dt>{{ $t('admin-media.projectRecovery.description') }}</dt>
    <dd>{{ value.description || $t('admin-media.projectRecovery.empty') }}</dd>
    <dt>{{ $t('admin-media.projectRecovery.state') }}</dt>
    <dd>
      {{ projectProgressLabel(value.progress, t) }} / {{ projectStatusLabel(value.status, t) }} / {{ value.sortOrder }}
    </dd>
    <dt>{{ $t('admin-media.projectRecovery.tags') }}</dt>
    <dd>
      <ul v-if="value.tags.length">
        <li v-for="(tag, index) in value.tags" :key="index">
          {{
            $t('admin-media.projectRecovery.tag', {
              label: tag.label || $t('admin-media.projectRecovery.tagNameEmpty'),
              color: tag.color,
            })
          }}
        </li>
      </ul>
      <template v-else>{{ $t('admin-media.projectRecovery.empty') }}</template>
    </dd>
    <dt>{{ $t('admin-media.projectRecovery.links') }}</dt>
    <dd>
      <ul v-if="value.links.length">
        <li v-for="(link, index) in value.links" :key="index">
          {{
            $t('admin-media.projectRecovery.link', {
              kind: projectLinkLabel(link.kind, t),
              href: link.href || $t('admin-media.projectRecovery.hrefEmpty'),
            })
          }}
        </li>
      </ul>
      <template v-else>{{ $t('admin-media.projectRecovery.empty') }}</template>
    </dd>
    <dt>{{ $t('admin-media.projectRecovery.relations') }}</dt>
    <dd>{{ contentRelationSummary(value.relatedContent, $t) }}</dd>
    <dt>{{ $t('admin-media.projectRecovery.cover') }}</dt>
    <dd>
      {{ value.coverMediaId || $t('admin-media.projectRecovery.noCover') }}
      <p v-if="value.coverMediaId">{{ $t('admin-media.projectRecovery.coverHint') }}</p>
    </dd>
  </dl>
</template>
<script setup lang="ts">
import { projectLinkLabel, projectProgressLabel, projectStatusLabel } from '~/features/project/types'
import type { ProjectEditable } from '~/features/project/types'
import { contentRelationSummary } from '~/features/content-relation/editor'
defineProps<{ value: ProjectEditable }>()
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
ul {
  margin: 0;
  padding-left: 1.25rem;
}
</style>
