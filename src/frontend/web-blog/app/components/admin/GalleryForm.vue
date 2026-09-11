<!-- @file GalleryForm.vue @description 图库作品编辑表单，媒体文件与作品发布状态分别说明 -->
<template>
  <form class="gallery-editor" @submit.prevent="$emit('save', value.status)">
    <header>
      <h1>{{ id ? '编辑照片作品' : '新建照片作品' }}</h1>
      <AdminBackLink to="/admin/gallery">返回图库管理</AdminBackLink
      ><NuxtLink v-if="saved?.status === 'published'" :to="`/gallery?photo=${id}`">查看公开作品</NuxtLink>
    </header>
    <p v-if="error" role="alert">
      {{ error }} <button type="button" :disabled="saving || loading" @click="$emit('reload')">重新读取</button>
    </p>
    <p v-if="notice" role="status">{{ notice }}</p>
    <p v-if="localError" role="alert">
      {{ localError }} <button type="button" @click="$emit('persist')">重试保存恢复副本</button>
    </p>
    <section v-if="recovery" class="gallery-editor__notice" aria-label="作品恢复副本">
      <h2>发现本标签页未保存的输入</h2>
      <AdminGalleryRecoveryDetails :value="recovery.form" />
      <button type="button" :disabled="saving || !ready" @click="$emit('restore')">恢复输入</button
      ><button type="button" :disabled="saving" @click="$emit('discard')">移除恢复副本</button>
    </section>
    <section v-if="previousRecoveries.length" class="gallery-editor__notice" aria-label="另外保留的图库恢复副本">
      <h2>另外保留的图库输入</h2>
      <p>这些副本可能属于其他内容库，不会直接写入当前作品。请核对后手动录入，并重新选择当前媒体库中的图片。</p>
      <article v-for="copy in previousRecoveries" :key="copy.key">
        <p>保存于 {{ copy.value.savedAt }}</p>
        <AdminGalleryRecoveryDetails :value="copy.value.form" />
      </article>
    </section>
    <section v-if="serverVersion" class="gallery-editor__notice" aria-label="作品服务器版本">
      <h2>服务器当前版本 {{ serverVersion.revision }}</h2>
      <p>{{ serverVersion.title }} · {{ statusLabels[serverVersion.status] }} · 排序 {{ serverVersion.sortOrder }}</p>
      <p>{{ serverVersion.description }}</p>
      <p>
        {{ serverVersion.category || '未分类' }} · {{ serverVersion.takenOn || '拍摄日期未填写' }} ·
        {{ serverVersion.location || '地点未填写' }} · {{ serverVersion.device || '器材未填写' }}
      </p>
      <CommonImageFrame
        class="gallery-editor__preview"
        :src="serverVersion.src"
        :alt="serverVersion.title"
        :width="serverVersion.width"
        :height="serverVersion.height"
        fit="contain"
      /><button type="button" :disabled="saving" @click="$emit('reload')">保留副本并载入服务器版本</button
      ><button type="button" :disabled="saving || !ready" @click="$emit('merge')">保留输入，按最新版本继续合并</button>
    </section>
    <p v-if="loading" role="status">正在读取作品…</p>
    <fieldset :disabled="!ready || loading">
      <label
        >作品标题<input
          :value="value.title"
          aria-label="作品标题"
          required
          maxlength="160"
          @input="change('title', ($event.target as HTMLInputElement).value)"
      /></label>
      <label
        >作品说明<textarea
          :value="value.description"
          aria-label="作品说明"
          maxlength="5000"
          rows="5"
          @input="change('description', ($event.target as HTMLTextAreaElement).value)"
        />
      </label>
      <section>
        <h2>作品图片</h2>
        <label
          >图片来源<select
            :value="value.source"
            aria-label="图片来源"
            @change="change('source', ($event.target as HTMLSelectElement).value as GalleryEditable['source'])"
          >
            <option value="media">媒体库图片</option>
            <option value="external">外部图片 URL</option>
          </select></label
        >
        <div v-if="value.source === 'external'">
          <label
            >外部图片地址<input
              :value="value.externalUrl"
              aria-label="外部图片地址"
              type="url"
              maxlength="2048"
              :aria-invalid="!!value.externalUrl && !!urlError"
              aria-describedby="gallery-url-help"
              @input="change('externalUrl', ($event.target as HTMLInputElement).value)"
          /></label>
          <p id="gallery-url-help">
            填写完整 HTTP(S) 图片直链，可带查询参数。地址不会被服务器下载或检查；HTTPS 页面中的 HTTP
            图片可能被浏览器阻止。
          </p>
          <p v-if="value.externalUrl && urlError" role="alert">{{ urlError }}</p>
          <template v-else-if="value.externalUrl">
            <p>地址格式合法，可以保存。预览结果不决定保存结果。</p>
            <CommonImageFrame
              :key="value.externalUrl"
              class="gallery-editor__preview"
              :src="value.externalUrl"
              :alt="value.title || '外部图片预览'"
              fit="contain"
              loading="eager"
              @state="previewState = $event"
            />
            <p role="status">
              {{
                previewState === 'ready'
                  ? '当前预览加载成功；显示比例来自浏览器实际尺寸，不写入作品资料。'
                  : previewState === 'error'
                    ? '当前预览加载失败，可能是地址失效、网络故障、防盗链或浏览器安全限制。可重试，也可以保存此合法地址。'
                    : '正在加载预览…'
              }}
            </p>
          </template>
        </div>
        <template v-else>
          <button type="button" @click="mediaOpen = true">选择或上传图片</button
          ><CommonImageFrame
            v-if="value.mediaId"
            class="gallery-editor__preview"
            :src="`/api/v1/media/${value.mediaId}.webp`"
            :alt="value.title || '作品图片'"
            fit="contain"
            :width="
              selectedMedia?.id === value.mediaId
                ? selectedMedia.width
                : saved?.mediaId === value.mediaId
                  ? saved.width
                  : undefined
            "
            :height="
              selectedMedia?.id === value.mediaId
                ? selectedMedia.height
                : saved?.mediaId === value.mediaId
                  ? saved.height
                  : undefined
            "
          />
          <p>
            上传文件不会自动公开为图库作品。发布状态控制作品展示；持有媒体文件地址的人仍可能访问文件。替换或删除作品不会删除其他内容使用的文件。
          </p>
        </template>
        <p>切换来源会保留本次未提交输入；保存时仅使用选定来源。</p>
      </section>
      <div class="gallery-editor__row">
        <label
          >分类<input
            :value="value.category"
            aria-label="作品分类"
            maxlength="40"
            placeholder="留空表示未分类"
            @input="change('category', ($event.target as HTMLInputElement).value)" /></label
        ><label
          >拍摄日期<input
            :value="value.takenOn ?? ''"
            aria-label="拍摄日期"
            type="date"
            @input="change('takenOn', ($event.target as HTMLInputElement).value || null)"
        /></label>
      </div>
      <p>拍摄日期、地点和器材均可留空，上传时间不会作为拍摄日期。</p>
      <div class="gallery-editor__row">
        <label
          >拍摄地点<input
            :value="value.location"
            aria-label="拍摄地点"
            maxlength="160"
            @input="change('location', ($event.target as HTMLInputElement).value)" /></label
        ><label
          >拍摄器材<input
            :value="value.device"
            aria-label="拍摄器材"
            maxlength="160"
            @input="change('device', ($event.target as HTMLInputElement).value)"
        /></label>
      </div>
      <div class="gallery-editor__row">
        <label
          >保存状态<select
            :value="value.status"
            aria-label="作品保存状态"
            @change="change('status', ($event.target as HTMLSelectElement).value as GalleryStatus)"
          >
            <option value="draft">草稿</option>
            <option value="published">已公开</option>
            <option value="withdrawn">已撤回</option>
          </select></label
        ><label
          >排序值（越大越靠前）<input
            :value="value.sortOrder"
            aria-label="作品排序值"
            type="number"
            min="-1000000"
            max="1000000"
            step="1"
            @input="change('sortOrder', Number(($event.target as HTMLInputElement).value))"
        /></label>
      </div>
    </fieldset>
    <p v-if="saved">
      创建于 {{ saved.createdAt }}<template v-if="saved.publishedAt"> · 首次发布于 {{ saved.publishedAt }}</template> ·
      版本 {{ saved.revision }}
    </p>
    <AdminActionBar>
      <button type="submit" :disabled="!ready || saving || loading || !value.title.trim() || !sourceValid">
        {{ saving ? '正在保存…' : '保存作品' }}</button
      ><button
        type="button"
        :disabled="!ready || saving || loading || !value.title.trim() || !sourceValid"
        @click="$emit('save', 'draft')"
      >
        保存草稿</button
      ><button
        type="button"
        :disabled="!ready || saving || loading || !value.title.trim() || !sourceValid"
        @click="$emit('save', 'published')"
      >
        发布作品</button
      ><span>{{ dirty ? '有尚未保存输入' : saved ? '当前输入已保存' : '尚未保存' }}</span>
    </AdminActionBar>
    <ClientOnly><AdminMediaPicker v-model:open="mediaOpen" @selected="selectMedia" /></ClientOnly>
  </form>
</template>
<script setup lang="ts">
import type { GalleryEditable, GalleryStatus, ManagedPhoto } from '~/features/gallery/types'
import type { GalleryRecovery } from '~/features/gallery/editor'
import { galleryUrlError } from '~/features/gallery/editor'
import type { MediaAsset } from '~/features/media/types'
import type { EditorRecoveryCopy } from '~/utils/editorRecoveryStorage'
const props = defineProps<{
  value: GalleryEditable
  id: number | null
  saved: ManagedPhoto | null
  serverVersion: ManagedPhoto | null
  recovery: GalleryRecovery | null
  previousRecoveries: EditorRecoveryCopy<GalleryRecovery>[]
  ready: boolean
  loading: boolean
  saving: boolean
  dirty: boolean
  error: string
  notice: string
  localError: string
}>()
const urlError = computed(() => galleryUrlError(props.value.externalUrl))
const sourceValid = computed(() => (props.value.source === 'external' ? !urlError.value : !!props.value.mediaId))
const previewState = ref('loading')
const emit = defineEmits<{
  change: [value: Partial<GalleryEditable>]
  save: [status: GalleryStatus]
  reload: []
  restore: []
  discard: []
  persist: []
  merge: []
}>()
const mediaOpen = ref(false),
  statusLabels = { draft: '草稿', published: '已公开', withdrawn: '已撤回' }
const selectedMedia = ref<MediaAsset | null>(null)
function change<K extends keyof GalleryEditable>(key: K, value: GalleryEditable[K]) {
  emit('change', { [key]: value })
}
function selectMedia(asset: MediaAsset) {
  selectedMedia.value = asset
  change('mediaId', asset.id)
}
</script>
<style scoped lang="scss">
.gallery-editor {
  display: grid;
  gap: 1rem;
  max-width: 1000px;
  overflow-wrap: anywhere;
}
header,
footer,
.gallery-editor__row {
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
  display: grid;
  gap: 1rem;
  padding: 0;
  border: 0;
  min-width: 0;
}
label {
  display: grid;
  gap: 0.4rem;
  min-width: 0;
}
.gallery-editor__row > label {
  flex: 1 1 180px;
}
input,
textarea,
select,
button {
  color: var(--text-main);
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  padding: 0.65rem;
  max-width: 100%;
}
input,
textarea,
select {
  width: 100%;
  min-width: 0;
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
.gallery-editor__notice {
  padding: 1rem;
  border: 1px solid var(--accent);
  border-radius: 0.5rem;
}
.gallery-editor__notice p {
  white-space: pre-wrap;
}
.gallery-editor__preview {
  max-width: 360px;
  margin-block: 0.75rem;
}
</style>
