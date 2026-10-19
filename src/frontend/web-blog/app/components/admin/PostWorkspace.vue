<!--
  @file PostWorkspace.vue
  @description 新建与编辑共用工作区，区分本机恢复与服务器保存，并展示版本比较。
-->
<template>
  <section class="post-workspace">
    <p v-if="error && !ready" role="alert">{{ error }}</p>
    <NuxtLink v-if="draft.deletedAt" to="/admin/posts?status=trash">{{
      $t('admin-content.postWorkspace.goToTrash')
    }}</NuxtLink>
    <ClientOnly>
      <section v-if="ready" class="post-workspace__saving" :aria-label="$t('admin-content.postWorkspace.savingStatus')">
        <p>
          {{
            $t('admin-content.postWorkspace.server', {
              state: automaticSaving
                ? $t('admin-content.postWorkspace.autoSaving')
                : pending
                  ? $t('admin-content.postWorkspace.saving')
                  : draft.savedAt
                    ? $t('admin-content.postWorkspace.savedAtRevision', {
                        time: formatTime(draft.savedAt),
                        revision: draft.revision,
                      })
                    : $t('admin-content.postWorkspace.notSaved'),
            })
          }}
        </p>
        <p>
          {{
            $t('admin-content.postWorkspace.local', {
              state: recovery.localSavedAt.value
                ? $t('admin-content.postWorkspace.savedAt', { time: formatTime(recovery.localSavedAt.value) })
                : $t('admin-content.postWorkspace.localAuto'),
            })
          }}
        </p>
        <p v-if="recovery.localError.value" role="alert">
          {{ recovery.localError.value }}
          <button type="button" @click="persistLocal">{{ $t('admin-content.postWorkspace.retryLocal') }}</button>
        </p>
        <label
          ><input v-model="serverAutoSave" type="checkbox" />{{
            $t('admin-content.postWorkspace.autoSaveToggle')
          }}</label
        >
        <p v-if="draft.status !== 'draft'">
          {{
            draft.status === 'published'
              ? $t('admin-content.postWorkspace.nonDraftPublished')
              : $t('admin-content.postWorkspace.nonDraftArchived')
          }}
        </p>
        <p v-if="autoSavePaused">{{ $t('admin-content.postWorkspace.autoSavePaused') }}</p>
        <p v-if="dirty">{{ $t('admin-content.postWorkspace.dirty') }}</p>
      </section>
      <AdminPostPreviewLink
        v-if="ready"
        :saved="!!draft.id"
        :available="preview.available.value"
        :dirty="dirty"
        :busy="pending"
        :pending="preview.pending.value"
        :copying="preview.copying.value"
        :url="preview.url.value"
        :expires-at="preview.link.value?.expiresAt ?? ''"
        :error="preview.error.value"
        :notice="preview.notice.value"
        @generate="preview.generate"
        @copy="preview.copy"
      />
      <section
        v-if="recovery.recoveries.value.length"
        class="post-workspace__recoveries"
        :aria-label="$t('admin-content.postWorkspace.recoveriesLabel')"
      >
        <h2>{{ $t('admin-content.postWorkspace.recoveriesTitle') }}</h2>
        <p>{{ $t('admin-content.postWorkspace.recoveriesHint') }}</p>
        <ul>
          <li v-for="item in recovery.recoveries.value" :key="item.key">
            <span>{{
              $t('admin-content.postWorkspace.recoveryItem', {
                title: item.draft.title || $t('admin-content.postWorkspace.untitled'),
                time: formatTime(item.savedAt),
                revision: item.draft.revision ?? $t('admin-content.postWorkspace.newRevision'),
              })
            }}</span>
            <button type="button" :disabled="pending || recoveryReviewPending" @click="reviewRecovery(item)">
              {{ $t('admin-content.postWorkspace.compareRecovery') }}</button
            ><button type="button" :disabled="pending" @click="discardRecovery(item)">
              {{ $t('admin-content.postWorkspace.discardRecovery') }}
            </button>
          </li>
        </ul>
        <button type="button" :disabled="pending" @click="continueWithoutRecovery">
          {{ $t('admin-content.postWorkspace.continueWithout') }}
        </button>
      </section>
    </ClientOnly>
    <AdminPostConflict
      v-if="conflict"
      :local="localForCompare"
      :server="conflict"
      @use-server="useServerVersion"
      @keep-local="keepLocalVersion"
    />
    <AdminPostConflict
      v-if="recoverySelection && recoveryServer"
      :local="recoverySelection.draft"
      :server="recoveryServer"
      :title="$t('admin-content.postWorkspace.compareTitle')"
      :description="$t('admin-content.postWorkspace.compareDescription')"
      :local-label="$t('admin-content.postWorkspace.compareLocal')"
      :server-label="$t('admin-content.postWorkspace.compareServer')"
      :use-server-label="$t('admin-content.postWorkspace.compareUseServer')"
      :keep-local-label="$t('admin-content.postWorkspace.compareKeepLocal')"
      @use-server="skipRecovery"
      @keep-local="applyRecovery"
    />
    <p v-if="preservedLocal">
      {{ $t('admin-content.postWorkspace.preserved')
      }}<button type="button" @click="recoverPreservedLocal">
        {{ $t('admin-content.postWorkspace.recoverPreserved') }}
      </button>
    </p>
    <ClientOnly
      ><AdminPostEditor
        v-if="ready"
        v-model="draft"
        v-model:tags="tags"
        :options="options"
        :pending="pending"
        :error="error"
        :dirty="dirty"
        @save="save"
        @reviewing="reviewingPublication = $event"
    /></ClientOnly>
    <ClientOnly
      ><AdminPostHistory
        v-if="ready && draft.id"
        :post-id="draft.id"
        :current="localForCompare"
        :busy="pending"
        @load-snapshot="loadHistorical"
        @restore-revision="restoreHistorical"
    /></ClientOnly>
  </section>
</template>
<script setup lang="ts">
const props = defineProps<{ id: string | null }>()
const {
  draft,
  tags,
  options,
  pending,
  ready,
  error,
  dirty,
  save,
  conflict,
  localForCompare,
  preservedLocal,
  useServerVersion,
  keepLocalVersion,
  recoverPreservedLocal,
  recovery,
  automaticSaving,
  serverAutoSave,
  autoSavePaused,
  recoverySelection,
  recoveryServer,
  recoveryReviewPending,
  reviewRecovery,
  applyRecovery,
  skipRecovery,
  discardRecovery,
  continueWithoutRecovery,
  persistLocal,
  loadHistorical,
  restoreHistorical,
  reviewingPublication,
} = usePostEditor(props.id)
const preview = usePostPreviewLink(draft, pending)
function formatTime(value: string) {
  return formatDateTime(value, { hour12: false })
}
</script>
<style scoped lang="scss">
.post-workspace__saving,
.post-workspace__recoveries {
  border: 1px solid var(--border);
  background: var(--surface-2);
  padding: 1rem;
  border-radius: 0.75rem;
  margin: 1rem 0;
}
.post-workspace__saving p,
.post-workspace__recoveries p {
  margin: 0.4rem 0;
  color: var(--text-muted);
}
.post-workspace__recoveries h2 {
  font-size: 1.1rem;
  font-weight: 600;
}
ul {
  list-style: none;
  padding: 0;
}
li {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.6rem;
  padding: 0.65rem 0;
}
button {
  color: var(--text-main);
  background: var(--surface-1);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  padding: 0.5rem 0.7rem;
}
</style>
