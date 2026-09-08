<!--
  @file PostWorkspace.vue
  @description 新建与编辑共用工作区，区分本机恢复与服务器保存，并展示版本比较。
-->
<template>
  <section class="post-workspace">
    <p v-if="error && !ready" role="alert">{{ error }}</p>
    <NuxtLink v-if="draft.deletedAt" to="/admin/posts?status=trash">前往文章回收站</NuxtLink>
    <ClientOnly>
      <section v-if="ready" class="post-workspace__saving" aria-label="文章保存状态">
        <p>
          服务器：{{
            automaticSaving
              ? '正在自动保存草稿…'
              : pending
                ? '正在保存…'
                : draft.savedAt
                  ? `已保存于 ${formatDate(draft.savedAt)} · 版本 ${draft.revision}`
                  : '尚未保存'
          }}
        </p>
        <p>
          本机恢复副本：{{
            recovery.localSavedAt.value ? `已保存于 ${formatDate(recovery.localSavedAt.value)}` : '输入修改后自动保存'
          }}。本机副本不会发布内容。
        </p>
        <p v-if="recovery.localError.value" role="alert">
          {{ recovery.localError.value }} <button type="button" @click="persistLocal">重试本机保存</button>
        </p>
        <label><input v-model="serverAutoSave" type="checkbox" />空闲 15 秒后自动保存服务器草稿</label>
        <p v-if="draft.status !== 'draft'">
          当前文章{{ draft.status === 'published' ? '已发布' : '已归档' }}，自动保存仅写本机副本；服务器内容需手动保存。
        </p>
        <p v-if="autoSavePaused">服务器自动保存已暂停，请比较恢复内容或冲突后手动保存。</p>
        <p v-if="dirty">有尚未保存到服务器的修改。</p>
      </section>
      <section v-if="recovery.recoveries.value.length" class="post-workspace__recoveries" aria-label="本机恢复副本">
        <h2>发现本机恢复副本</h2>
        <p>这些内容可能来自上次刷新、断网或其他编辑标签页。请先比较，再决定是否载入。</p>
        <ul>
          <li v-for="item in recovery.recoveries.value" :key="item.key">
            <span
              >{{ item.draft.title || '未命名草稿' }} · {{ formatDate(item.savedAt) }} · 基于版本
              {{ item.draft.revision ?? '新建' }}</span
            >
            <button type="button" :disabled="pending || recoveryReviewPending" @click="reviewRecovery(item)">
              比较恢复副本</button
            ><button type="button" :disabled="pending" @click="discardRecovery(item)">移除副本</button>
          </li>
        </ul>
        <button type="button" :disabled="pending" @click="continueWithoutRecovery">暂不恢复，继续编辑当前内容</button>
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
      title="恢复副本与服务器内容比较"
      description="载入只改变编辑器，不会立即写入服务器；请检查并合并后手动保存。"
      local-label="本机副本"
      server-label="最新服务器"
      use-server-label="取消恢复，保留副本"
      keep-local-label="载入本机副本继续编辑"
      @use-server="skipRecovery"
      @keep-local="applyRecovery"
    />
    <p v-if="preservedLocal">
      此前输入已保留为本机副本。<button type="button" @click="recoverPreservedLocal">恢复此前输入继续编辑</button>
    </p>
    <ClientOnly
      ><AdminPostEditor
        v-if="ready"
        v-model="draft"
        v-model:tags="tags"
        :options="options"
        :pending="pending"
        :error="error"
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
function formatDate(value: string) {
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
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
