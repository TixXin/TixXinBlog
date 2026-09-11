<!-- @file ProjectForm.vue @description 项目编辑展示表单，公开状态、项目进展和媒体文件分别管理 -->
<template>
  <form class="project-editor" @submit.prevent="$emit('save', value.status)">
    <header>
      <h1>{{ id ? '编辑项目' : '新建项目' }}</h1>
      <AdminBackLink to="/admin/projects">返回项目管理</AdminBackLink
      ><NuxtLink v-if="saved?.status === 'published'" :to="`/projects?q=${encodeURIComponent(saved.title)}`"
        >查看公开项目</NuxtLink
      >
    </header>
    <p v-if="error" role="alert">
      {{ error }} <button type="button" :disabled="saving || loading" @click="$emit('reload')">重新读取</button>
    </p>
    <p v-if="notice" role="status">{{ notice }}</p>
    <p v-if="localError" role="alert">
      {{ localError }} <button type="button" @click="$emit('persist')">重试保存恢复副本</button>
    </p>
    <section v-if="recovery" class="project-editor__notice" aria-label="项目恢复副本">
      <h2>发现本标签页未保存的输入</h2>
      <AdminProjectRecoveryDetails :value="recovery.form" />
      <button type="button" :disabled="saving || !ready" @click="$emit('restore')">恢复输入</button
      ><button type="button" :disabled="saving" @click="$emit('discard')">移除恢复副本</button>
    </section>
    <section v-if="previousRecoveries.length" class="project-editor__notice" aria-label="另外保留的项目恢复副本">
      <h2>另外保留的项目输入</h2>
      <p>这些副本可能属于其他内容库，不会直接写入当前项目。请核对后手动录入，并重新选择当前媒体库中的封面。</p>
      <article v-for="copy in previousRecoveries" :key="copy.key">
        <p>保存于 {{ copy.value.savedAt }}</p>
        <AdminProjectRecoveryDetails :value="copy.value.form" />
      </article>
    </section>
    <section v-if="serverVersion" class="project-editor__notice" aria-label="项目服务器版本">
      <h2>服务器当前版本 {{ serverVersion.revision }}</h2>
      <p>
        {{ serverVersion.title }} · {{ projectStatusLabels[serverVersion.status] }} ·
        {{ projectProgressLabels[serverVersion.progress] }} · 排序 {{ serverVersion.sortOrder }}
      </p>
      <p>{{ serverVersion.description }}</p>
      <p>技术：{{ serverVersion.tags.map((tag) => tag.label).join('、') || '未填写' }}</p>
      <ul>
        <li v-for="link in serverVersion.links" :key="link.kind">
          {{ projectLinkLabels[link.kind] }}：{{ link.href }}
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
      <p v-else>未设置封面</p>
      <button type="button" :disabled="saving" @click="$emit('reload')">保留副本并载入服务器版本</button
      ><button type="button" :disabled="saving || !ready" @click="$emit('merge')">保留输入，按最新版本继续合并</button>
    </section>
    <p v-if="loading" role="status">正在读取项目…</p>
    <fieldset :disabled="!ready || loading">
      <label
        >项目标题<input
          :value="value.title"
          aria-label="项目标题"
          required
          maxlength="160"
          @input="change('title', ($event.target as HTMLInputElement).value)"
      /></label>
      <label
        >项目介绍<textarea
          :value="value.description"
          aria-label="项目介绍"
          rows="6"
          maxlength="5000"
          @input="change('description', ($event.target as HTMLTextAreaElement).value)"
        />
      </label>
      <section aria-label="项目封面">
        <h2>项目封面</h2>
        <button type="button" @click="mediaOpen = true">选择或上传封面</button
        ><button v-if="value.coverMediaId" type="button" @click="change('coverMediaId', null)">移除封面</button
        ><CommonImageFrame
          v-if="value.coverMediaId"
          class="project-editor__preview"
          :src="`/api/v1/media/${value.coverMediaId}.webp`"
          :alt="value.title || '项目封面'"
          :width="
            selectedMedia?.id === value.coverMediaId
              ? selectedMedia.width
              : saved?.coverMediaId === value.coverMediaId
                ? (saved.width ?? undefined)
                : undefined
          "
          :height="
            selectedMedia?.id === value.coverMediaId
              ? selectedMedia.height
              : saved?.coverMediaId === value.coverMediaId
                ? (saved.height ?? undefined)
                : undefined
          "
          fit="contain"
        />
        <p v-else>未设置封面，公开项目会显示简洁占位。</p>
        <p>上传文件不会自动公开项目；持有文件地址的人仍可访问媒体。移除封面或删除项目会保留其他内容的媒体引用。</p>
      </section>
      <div class="project-editor__row">
        <label
          >项目进展<select
            :value="value.progress"
            aria-label="项目进展"
            @change="change('progress', ($event.target as HTMLSelectElement).value as ProjectProgress)"
          >
            <option v-for="(label, progress) in projectProgressLabels" :key="progress" :value="progress">
              {{ label }}
            </option>
          </select></label
        ><label
          >保存状态<select
            :value="value.status"
            aria-label="项目保存状态"
            @change="change('status', ($event.target as HTMLSelectElement).value as ProjectPublicationStatus)"
          >
            <option v-for="(label, status) in projectStatusLabels" :key="status" :value="status">{{ label }}</option>
          </select></label
        ><label
          >排序值（越大越靠前）<input
            :value="value.sortOrder"
            aria-label="项目排序值"
            type="number"
            min="-1000000"
            max="1000000"
            step="1"
            @input="change('sortOrder', Number(($event.target as HTMLInputElement).value))"
        /></label>
      </div>
      <p>进展描述项目本身。已归档的项目仍可公开；开发中的项目也可保留为草稿。</p>
      <section aria-label="项目技术标签">
        <h2>技术标签（{{ value.tags.length }} / 20）</h2>
        <div v-for="(tag, index) in value.tags" :key="index" class="project-editor__row">
          <label
            >技术名称<input
              :value="tag.label"
              :aria-label="`技术名称 ${index + 1}`"
              maxlength="40"
              required
              @input="changeTag(index, { label: ($event.target as HTMLInputElement).value })" /></label
          ><label
            >标签颜色<select
              :value="tag.color"
              :aria-label="`技术颜色 ${index + 1}`"
              @change="changeTag(index, { color: ($event.target as HTMLSelectElement).value as ProjectTag['color'] })"
            >
              <option v-for="color in projectTagColors" :key="color" :value="color">{{ colorLabels[color] }}</option>
            </select></label
          ><button
            type="button"
            :aria-label="`移除技术 ${index + 1}`"
            @click="
              change(
                'tags',
                value.tags.filter((_, i) => i !== index),
              )
            "
          >
            移除技术
          </button>
        </div>
        <button
          type="button"
          :disabled="value.tags.length >= 20"
          @click="change('tags', [...value.tags, { label: '', color: 'blue' }])"
        >
          添加技术标签
        </button>
        <p>同一项目的重复技术忽略大小写合并；公开技术分布按实际使用这些标签的项目统计。</p>
      </section>
      <section aria-label="项目链接">
        <h2>项目链接（{{ value.links.length }} / 4）</h2>
        <div v-for="(link, index) in value.links" :key="index" class="project-editor__row">
          <label
            >链接用途<select
              :value="link.kind"
              :aria-label="`链接用途 ${index + 1}`"
              @change="changeLink(index, { kind: ($event.target as HTMLSelectElement).value as ProjectLinkKind })"
            >
              <option
                v-for="(label, kind) in projectLinkLabels"
                :key="kind"
                :value="kind"
                :disabled="value.links.some((other, i) => i !== index && other.kind === kind)"
              >
                {{ label }}
              </option>
            </select></label
          ><label
            >链接地址<input
              :value="link.href"
              :aria-label="`链接地址 ${index + 1}`"
              type="url"
              pattern="https?://.+"
              required
              maxlength="2048"
              placeholder="https://"
              @input="changeLink(index, { href: ($event.target as HTMLInputElement).value })" /></label
          ><button
            type="button"
            :aria-label="`移除链接 ${index + 1}`"
            @click="
              change(
                'links',
                value.links.filter((_, i) => i !== index),
              )
            "
          >
            移除链接
          </button>
        </div>
        <button type="button" :disabled="value.links.length >= 4" @click="addLink">添加项目链接</button>
        <p v-if="!value.links.length">尚未提供公开链接，可在准备好地址后添加。</p>
      </section>
    </fieldset>
    <p v-if="saved">
      创建于 {{ saved.createdAt }}<template v-if="saved.publishedAt"> · 首次发布于 {{ saved.publishedAt }}</template> ·
      版本 {{ saved.revision }}
    </p>
    <AdminActionBar>
      <button type="submit" :disabled="!ready || loading || saving || !value.title.trim()">
        {{ saving ? '正在保存…' : '保存项目' }}</button
      ><button
        type="button"
        :disabled="!ready || loading || saving || !value.title.trim()"
        @click="$emit('save', 'draft')"
      >
        保存草稿</button
      ><button
        type="button"
        :disabled="!ready || loading || saving || !value.title.trim()"
        @click="$emit('save', 'published')"
      >
        发布项目</button
      ><span>{{ dirty ? '有尚未保存输入' : saved ? '当前输入已保存' : '尚未保存' }}</span>
    </AdminActionBar>
    <ClientOnly><AdminMediaPicker v-model:open="mediaOpen" @selected="selectMedia" /></ClientOnly>
  </form>
</template>
<script setup lang="ts">
import {
  projectProgressLabels,
  projectStatusLabels,
  projectTagColors,
  projectLinkLabels,
} from '~/features/project/types'
import type {
  ManagedProject,
  ProjectEditable,
  ProjectProgress,
  ProjectPublicationStatus,
  ProjectTag,
  ProjectLinkInput,
  ProjectLinkKind,
} from '~/features/project/types'
import type { ProjectRecovery } from '~/features/project/editor'
import type { MediaAsset } from '~/features/media/types'
import type { EditorRecoveryCopy } from '~/utils/editorRecoveryStorage'
const props = defineProps<{
  value: ProjectEditable
  id: number | null
  saved: ManagedProject | null
  serverVersion: ManagedProject | null
  recovery: ProjectRecovery | null
  previousRecoveries: EditorRecoveryCopy<ProjectRecovery>[]
  ready: boolean
  loading: boolean
  saving: boolean
  dirty: boolean
  error: string
  notice: string
  localError: string
}>()
const emit = defineEmits<{
  change: [value: Partial<ProjectEditable>]
  save: [status: ProjectPublicationStatus]
  reload: []
  restore: []
  discard: []
  persist: []
  merge: []
}>()
const mediaOpen = ref(false),
  selectedMedia = ref<MediaAsset | null>(null)
const colorLabels = { emerald: '翠绿', blue: '蓝色', amber: '琥珀', sky: '天蓝', rose: '玫红', slate: '灰色' }
function change<K extends keyof ProjectEditable>(key: K, value: ProjectEditable[K]) {
  emit('change', { [key]: value })
}
function changeTag(index: number, patch: Partial<ProjectTag>) {
  change(
    'tags',
    props.value.tags.map((tag, i) => (i === index ? { ...tag, ...patch } : { ...tag })),
  )
}
function changeLink(index: number, patch: Partial<ProjectLinkInput>) {
  change(
    'links',
    props.value.links.map((link, i) => (i === index ? { ...link, ...patch } : { ...link })),
  )
}
function addLink() {
  const kind = (Object.keys(projectLinkLabels) as ProjectLinkKind[]).find(
    (kind) => !props.value.links.some((link) => link.kind === kind),
  )
  if (kind) change('links', [...props.value.links, { kind, href: '' }])
}
function selectMedia(asset: MediaAsset) {
  selectedMedia.value = asset
  change('coverMediaId', asset.id)
}
</script>
<style scoped lang="scss">
.project-editor {
  display: grid;
  gap: 1rem;
  max-width: 1000px;
  overflow-wrap: anywhere;
}
header,
footer,
.project-editor__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
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
.project-editor__row > label {
  flex: 1 1 180px;
}
.project-editor__row {
  margin-block: 0.65rem;
}
input,
textarea,
select,
button {
  max-width: 100%;
  min-width: 0;
  color: var(--text-main);
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  padding: 0.65rem;
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
.project-editor__notice {
  padding: 1rem;
  border: 1px solid var(--accent);
  border-radius: 0.5rem;
}
.project-editor__notice p {
  white-space: pre-wrap;
}
.project-editor__preview {
  max-width: 360px;
  margin-block: 0.75rem;
}
</style>
