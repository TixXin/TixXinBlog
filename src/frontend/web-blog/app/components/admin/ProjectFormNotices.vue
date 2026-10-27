<!-- @file ProjectFormNotices.vue @description 项目编辑表单的恢复提示：本机恢复副本、另外保留的旧副本与服务器上的新版本 -->
<template>
  <section v-if="recovery" class="project-editor__notice" :aria-label="$t('admin-media.projectForm.recoveryLabel')">
    <h2>{{ $t('admin-media.projectForm.recoveryTitle') }}</h2>
    <AdminProjectRecoveryDetails :value="recovery.form" />
    <button type="button" :disabled="saving || !ready" @click="emit('restore')">
      {{ $t('admin-media.projectForm.restore') }}</button
    ><button type="button" :disabled="saving" @click="emit('discard')">
      {{ $t('admin-media.projectForm.discardRecovery') }}
    </button>
  </section>
  <section
    v-if="previousRecoveries.length"
    class="project-editor__notice"
    :aria-label="$t('admin-media.projectForm.previousLabel')"
  >
    <h2>{{ $t('admin-media.projectForm.previousTitle') }}</h2>
    <p>{{ $t('admin-media.projectForm.previousBody') }}</p>
    <article v-for="copy in previousRecoveries" :key="copy.key">
      <p>{{ $t('admin-media.projectForm.savedAt', { time: copy.value.savedAt }) }}</p>
      <AdminProjectRecoveryDetails :value="copy.value.form" />
    </article>
  </section>
  <section v-if="serverVersion" class="project-editor__notice" :aria-label="$t('admin-media.projectForm.serverLabel')">
    <h2>{{ $t('admin-media.projectForm.serverTitle', { revision: serverVersion.revision }) }}</h2>
    <p>
      {{
        $t('admin-media.projectForm.serverMeta', {
          title: serverVersion.title,
          status: projectStatusLabel(serverVersion.status, t),
          progress: projectProgressLabel(serverVersion.progress, t),
          sort: serverVersion.sortOrder,
        })
      }}
    </p>
    <p>{{ serverVersion.description }}</p>
    <p>
      {{
        $t('admin-media.projectForm.serverRelations', {
          relations: contentRelationSummary(serverVersion.relatedContent, $t),
        })
      }}
    </p>
    <p>
      {{
        $t('admin-media.projectForm.serverTags', {
          tags:
            serverVersion.tags.map((tag) => tag.label).join($t('admin-media.projectForm.tagSeparator')) ||
            $t('admin-media.projectForm.notFilled'),
        })
      }}
    </p>
    <ul>
      <li v-for="link in serverVersion.links" :key="link.kind">
        {{ $t('admin-media.projectForm.serverLink', { kind: projectLinkLabel(link.kind, t), href: link.href }) }}
      </li>
    </ul>
    <CommonImageFrame
      v-if="serverVersion.cover"
      class="project-editor__preview"
      :src="serverVersion.cover"
      :alt="serverVersion.title"
      :width="serverVersion.width ?? undefined"
      :height="serverVersion.height ?? undefined"
      fit="contain"
    />
    <p v-else>{{ $t('admin-media.projectForm.noCover') }}</p>
    <button type="button" :disabled="saving" @click="emit('reload')">
      {{ $t('admin-media.projectForm.loadServer') }}</button
    ><button type="button" :disabled="saving || !ready" @click="emit('merge')">
      {{ $t('admin-media.projectForm.merge') }}
    </button>
  </section>
</template>
<script setup lang="ts">
import { projectLinkLabel, projectProgressLabel, projectStatusLabel } from '~/features/project/types'
import type { ManagedProject } from '~/features/project/types'
import type { ProjectRecovery } from '~/features/project/editor'
import { contentRelationSummary } from '~/features/content-relation/editor'
import type { EditorRecoveryCopy } from '~/utils/editorRecoveryStorage'

defineProps<{
  recovery: ProjectRecovery | null
  previousRecoveries: EditorRecoveryCopy<ProjectRecovery>[]
  serverVersion: ManagedProject | null
  ready: boolean
  saving: boolean
}>()
const emit = defineEmits<{ restore: []; discard: []; reload: []; merge: [] }>()
const { t } = useI18n()
</script>
<style scoped lang="scss">
@use '~/assets/styles/project-editor' as project;

@include project.form;
</style>
