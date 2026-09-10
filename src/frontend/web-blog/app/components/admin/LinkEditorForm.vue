<!-- @file LinkEditorForm.vue @description 友链管理表单，网址重复可修正，Logo来源互斥并保留编辑副本 -->
<template>
  <form class="link-editor" @submit.prevent="$emit('save', value.status)">
    <header>
      <h1>{{ id ? '编辑友链' : '新建友链' }}</h1>
      <NuxtLink to="/admin/links">返回友链管理</NuxtLink
      ><NuxtLink v-if="saved?.status === 'published'" :to="`/links?q=${encodeURIComponent(saved.name)}`"
        >查看公开友链</NuxtLink
      >
    </header>
    <p v-if="error" role="alert">
      {{ error }} <button type="button" :disabled="saving || loading" @click="$emit('reload')">重新读取</button>
    </p>
    <p v-if="notice" role="status">{{ notice }}</p>
    <p v-if="localError" role="alert">
      {{ localError }} <button type="button" @click="$emit('persist')">重试保存恢复副本</button>
    </p>
    <section v-if="recovery" class="link-editor__notice" aria-label="友链恢复副本">
      <h2>发现本标签页未保存的输入</h2>
      <AdminLinkRecoveryDetails :value="recovery.form" /><button
        type="button"
        :disabled="saving || !ready"
        @click="$emit('restore')"
      >
        恢复输入</button
      ><button type="button" :disabled="saving" @click="$emit('discard')">移除恢复副本</button>
    </section>
    <section v-if="previousRecoveries.length" class="link-editor__notice" aria-label="另外保留的友链恢复副本">
      <h2>另外保留的友链输入</h2>
      <p>这些副本可能属于其他内容库，不会直接写入当前友链。请核对后手动录入，并重新选择Logo。</p>
      <article v-for="copy in previousRecoveries" :key="copy.key">
        <p>保存于 {{ copy.value.savedAt }}</p>
        <AdminLinkRecoveryDetails :value="copy.value.form" />
      </article>
    </section>
    <section v-if="serverVersion" class="link-editor__notice" aria-label="友链服务器版本">
      <h2>服务器当前版本 {{ serverVersion.revision }}</h2>
      <AdminLinkRecoveryDetails :value="serverVersion" /><button
        type="button"
        :disabled="saving"
        @click="$emit('reload')"
      >
        保留副本并载入服务器版本</button
      ><button type="button" :disabled="saving || !ready" @click="$emit('merge')">保留输入，按最新版本继续合并</button>
    </section>
    <p v-if="loading" role="status">正在读取友链…</p>
    <fieldset :disabled="!ready || loading">
      <label
        >站点名称<input
          :value="value.name"
          aria-label="友链站点名称"
          required
          maxlength="80"
          @input="change('name', ($event.target as HTMLInputElement).value)" /></label
      ><label
        >站点介绍<textarea
          :value="value.description"
          aria-label="友链站点介绍"
          rows="4"
          maxlength="300"
          @input="change('description', ($event.target as HTMLTextAreaElement).value)"
        /></label
      ><label
        >站点地址<input
          :value="value.url"
          aria-label="友链站点地址"
          type="url"
          pattern="https?://.+"
          required
          maxlength="2048"
          placeholder="https://example.com"
          @input="change('url', ($event.target as HTMLInputElement).value)"
      /></label>
      <p>填写完整HTTP或HTTPS地址。同域不同路径可以分别维护；不会自动抓取标题、Logo或检测连通性。</p>
      <section aria-label="友链Logo">
        <h2>Logo（可选）</h2>
        <div class="link-editor__row">
          <button type="button" @click="mediaOpen = true">选择或上传Logo</button
          ><button
            v-if="value.logoMediaId || value.logoUrl"
            type="button"
            @click="$emit('change', { logoMediaId: null, logoUrl: null })"
          >
            移除Logo
          </button>
        </div>
        <label
          >外部Logo地址（仅HTTPS）<input
            :value="value.logoUrl ?? ''"
            aria-label="外部Logo地址"
            type="url"
            pattern="https://.+"
            maxlength="2048"
            placeholder="https://example.com/logo.png"
            @input="
              $emit('change', { logoMediaId: null, logoUrl: ($event.target as HTMLInputElement).value || null })
            " /></label
        ><CommonImageFrame
          v-if="value.logoMediaId"
          class="link-editor__logo"
          :src="`/api/v1/media/${value.logoMediaId}.webp`"
          :alt="value.name || '友链Logo'"
          :width="selectedMedia?.id === value.logoMediaId ? selectedMedia.width : (saved?.width ?? undefined)"
          :height="selectedMedia?.id === value.logoMediaId ? selectedMedia.height : (saved?.height ?? undefined)"
          fit="contain"
        /><CommonImageFrame
          v-else-if="saved?.logoUrl && saved.logoUrl === value.logoUrl"
          class="link-editor__logo"
          :src="saved.logoUrl"
          :alt="value.name || '友链Logo'"
          fit="contain"
        />
        <p v-else>{{ value.logoUrl ? '保存后会使用该HTTPS图片地址。' : '未设置Logo，前台会显示通用站点图标。' }}</p>
        <p>媒体与外部地址二选一。更换或删除友链只释放本条记录的引用，其他内容使用的媒体会保留。</p>
      </section>
      <div class="link-editor__row">
        <label
          >保存状态<select
            :value="value.status"
            aria-label="友链保存状态"
            @change="change('status', ($event.target as HTMLSelectElement).value as LinkStatus)"
          >
            <option v-for="(label, status) in linkStatusLabels" :key="status" :value="status">{{ label }}</option>
          </select></label
        ><label
          >排序值（越大越靠前）<input
            :value="value.sortOrder"
            aria-label="友链排序值"
            type="number"
            step="1"
            min="-1000000"
            max="1000000"
            @input="change('sortOrder', Number(($event.target as HTMLInputElement).value))" /></label
        ><label class="link-editor__check"
          ><input
            :checked="value.isFeatured"
            aria-label="推荐友链"
            type="checkbox"
            @change="change('isFeatured', ($event.target as HTMLInputElement).checked)"
          />推荐友链</label
        >
      </div>
      <p>推荐项排在前面。推荐是博主选择，不代表已验证互链。</p>
    </fieldset>
    <p v-if="saved">
      创建于 {{ saved.createdAt }}<template v-if="saved.publishedAt"> · 首次上架于 {{ saved.publishedAt }}</template> ·
      版本 {{ saved.revision }}
    </p>
    <footer>
      <button type="submit" :disabled="!ready || loading || saving || !value.name.trim() || !value.url.trim()">
        {{ saving ? '正在保存…' : '保存友链' }}</button
      ><button
        type="button"
        :disabled="!ready || loading || saving || !value.name.trim() || !value.url.trim()"
        @click="$emit('save', 'draft')"
      >
        保存草稿</button
      ><button
        type="button"
        :disabled="!ready || loading || saving || !value.name.trim() || !value.url.trim()"
        @click="$emit('save', 'published')"
      >
        上架友链</button
      ><span>{{ dirty ? '有尚未保存输入' : saved ? '当前输入已保存' : '尚未保存' }}</span>
    </footer>
    <ClientOnly><AdminMediaPicker v-model:open="mediaOpen" @selected="selectMedia" /></ClientOnly>
  </form>
</template>
<script setup lang="ts">
import { linkStatusLabels } from '~/features/link/types'
import type { LinkEditable, LinkStatus, ManagedLink } from '~/features/link/types'
import type { LinkRecovery } from '~/features/link/editor'
import type { MediaAsset } from '~/features/media/types'
import type { EditorRecoveryCopy } from '~/utils/editorRecoveryStorage'
defineProps<{
  value: LinkEditable
  id: number | null
  saved: ManagedLink | null
  serverVersion: ManagedLink | null
  recovery: LinkRecovery | null
  previousRecoveries: EditorRecoveryCopy<LinkRecovery>[]
  ready: boolean
  loading: boolean
  saving: boolean
  dirty: boolean
  error: string
  notice: string
  localError: string
}>()
const emit = defineEmits<{
  change: [value: Partial<LinkEditable>]
  save: [status: LinkStatus]
  reload: []
  restore: []
  discard: []
  persist: []
  merge: []
}>()
const mediaOpen = ref(false),
  selectedMedia = ref<MediaAsset | null>(null)
function change<K extends keyof LinkEditable>(key: K, value: LinkEditable[K]) {
  emit('change', { [key]: value })
}
function selectMedia(asset: MediaAsset) {
  selectedMedia.value = asset
  emit('change', { logoMediaId: asset.id, logoUrl: null })
}
</script>
<style scoped lang="scss">
.link-editor {
  display: grid;
  gap: 1rem;
  max-width: 1000px;
  overflow-wrap: anywhere;
}
header,
footer,
.link-editor__row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
}
h1 {
  font-size: 1.5rem;
  font-weight: 700;
  margin-right: auto;
}
h2 {
  font-size: 1rem;
  font-weight: 600;
}
fieldset {
  border: 0;
  padding: 0;
  display: grid;
  gap: 1rem;
  min-width: 0;
}
label {
  display: grid;
  gap: 0.4rem;
  min-width: 0;
}
.link-editor__row > label {
  flex: 1 1 180px;
}
input,
textarea,
select,
button {
  max-width: 100%;
  min-width: 0;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  padding: 0.65rem;
  color: var(--text-main);
  background: var(--surface-2);
}
input,
textarea,
select {
  width: 100%;
}
textarea {
  resize: vertical;
}
button {
  min-height: 44px;
  cursor: pointer;
}
button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
p {
  color: var(--text-muted);
  line-height: 1.7;
}
a {
  color: var(--accent);
}
.link-editor__notice {
  padding: 1rem;
  border: 1px solid var(--accent);
  border-radius: 0.5rem;
}
.link-editor__logo {
  max-width: 200px;
  margin-block: 0.75rem;
}
.link-editor__check {
  display: flex;
  align-items: center;
}
.link-editor__check input {
  width: auto;
}
</style>
