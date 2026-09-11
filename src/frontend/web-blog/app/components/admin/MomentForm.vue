<!-- @file MomentForm.vue @description 动态编辑展示表单，数据与保存事件由页面提供 -->
<template>
  <form class="moment-editor" @submit.prevent="$emit('save', value.status)">
    <header class="moment-editor__heading">
      <h1>{{ id ? '编辑动态' : '发布动态' }}</h1>
      <AdminBackLink to="/admin/moments">返回动态管理</AdminBackLink>
      <NuxtLink v-if="id && saved?.status === 'published'" :to="`/moments/${id}`">查看公开动态</NuxtLink>
    </header>
    <p v-if="error" role="alert">
      {{ error }} <button type="button" :disabled="saving || loading" @click="$emit('reload')">重新读取</button>
    </p>
    <p v-if="notice" role="status">{{ notice }}</p>
    <p v-if="localError" role="alert">
      {{ localError }} <button type="button" @click="$emit('persist')">重试保存恢复副本</button>
    </p>
    <section v-if="recovery" class="moment-editor__recovery" aria-label="动态恢复副本">
      <h2>发现本标签页未保存的输入</h2>
      <p>{{ recovery.form.content.slice(0, 160) }}</p>
      <button type="button" :disabled="saving" @click="$emit('restore')">恢复输入</button>
      <button type="button" :disabled="saving" @click="$emit('discard')">移除恢复副本</button>
    </section>
    <section v-if="serverVersion" class="moment-editor__recovery" aria-label="动态服务器版本">
      <h2>服务器当前版本 {{ serverVersion.revision }}</h2>
      <p>{{ statusText[serverVersion.status] }} · {{ serverVersion.topics?.join('、') }}</p>
      <blockquote>{{ serverVersion.content }}</blockquote>
      <button type="button" :disabled="saving" @click="$emit('reload')">保留副本并载入服务器版本</button>
    </section>
    <p v-if="loading" role="status">正在读取动态…</p>
    <fieldset :disabled="!ready || loading">
      <label
        >动态正文<textarea
          :value="value.content"
          aria-label="动态正文"
          rows="8"
          maxlength="10000"
          required
          placeholder="记录此刻的想法，支持 Markdown"
          @input="change('content', ($event.target as HTMLTextAreaElement).value)"
        />
      </label>
      <small>{{ value.content.length }} / 10000</small>
      <label
        >话题（逗号分隔，最多10个）<input
          :value="value.topics.join('，')"
          aria-label="动态话题"
          @change="
            change(
              'topics',
              ($event.target as HTMLInputElement).value
                .split(/[,，]/)
                .map((v) => v.trim().replace(/^#+/, ''))
                .filter(Boolean),
            )
          "
      /></label>
      <section class="moment-editor__media" aria-label="动态配图">
        <h2>配图（{{ value.images.length }} / 9）</h2>
        <button type="button" :disabled="value.images.length >= 9" @click="mediaOpen = true">选择或上传图片</button>
        <div class="moment-editor__images">
          <figure v-for="(url, index) in value.images" :key="url">
            <img :src="url" :alt="`动态配图 ${index + 1}`" />
            <button
              type="button"
              :aria-label="`移除配图 ${index + 1}`"
              @click="
                change(
                  'images',
                  value.images.filter((_, i) => i !== index),
                )
              "
            >
              移除此配图
            </button>
          </figure>
        </div>
      </section>
      <div class="moment-editor__row">
        <label
          >地点<input
            :value="value.location"
            maxlength="160"
            @input="change('location', ($event.target as HTMLInputElement).value)"
        /></label>
        <label
          >设备<input
            :value="value.device"
            maxlength="80"
            @input="change('device', ($event.target as HTMLInputElement).value)"
        /></label>
        <label
          >心情<input
            :value="value.mood"
            maxlength="80"
            @input="change('mood', ($event.target as HTMLInputElement).value)"
        /></label>
      </div>
      <label
        >引用内容<select
          :value="value.linkedLink ? 'link' : value.linkedArticleId ? 'article' : linkMode"
          aria-label="动态引用类型"
          @change="setLinkMode(($event.target as HTMLSelectElement).value)"
        >
          <option value="none">不引用</option>
          <option value="article">站内文章</option>
          <option value="link">外部链接</option>
        </select></label
      >
      <section v-if="linkMode === 'article' || value.linkedArticleId">
        <label
          >搜索公开文章<input
            v-model="articleSearch"
            type="search"
            aria-label="搜索引用文章"
            maxlength="200"
            placeholder="输入文章标题"
            @input="$emit('search-articles', articleSearch)"
        /></label>
        <p v-if="articlesPending" role="status">正在搜索文章…</p>
        <p v-if="articlesError" role="alert">{{ articlesError }}</p>
        <label
          >引用文章<select
            :value="value.linkedArticleId ?? ''"
            aria-label="引用文章"
            @change="
              change(
                'linkedArticleId',
                ($event.target as HTMLSelectElement).value ? Number(($event.target as HTMLSelectElement).value) : null,
              )
            "
          >
            <option value="">请选择已公开文章</option>
            <option v-for="post in articleChoices" :key="post.id" :value="post.id">{{ post.title }}</option>
          </select></label
        >
      </section>
      <div v-if="value.linkedLink" class="moment-editor__row">
        <label
          >链接地址<input
            :value="value.linkedLink.url"
            type="url"
            maxlength="2048"
            aria-label="引用链接地址"
            @input="changeLink({ url: ($event.target as HTMLInputElement).value })"
        /></label>
        <label
          >链接标题<input
            :value="value.linkedLink.title"
            maxlength="160"
            aria-label="引用链接标题"
            @input="changeLink({ title: ($event.target as HTMLInputElement).value })"
        /></label>
        <label
          >链接描述<input
            :value="value.linkedLink.description"
            maxlength="500"
            @input="changeLink({ description: ($event.target as HTMLInputElement).value })"
        /></label>
        <label
          >站点名称<input
            :value="value.linkedLink.siteName"
            maxlength="80"
            @input="changeLink({ siteName: ($event.target as HTMLInputElement).value })"
        /></label>
        <label
          >卡片图片链接（可选）<input
            :value="value.linkedLink.image"
            maxlength="2048"
            @input="changeLink({ image: ($event.target as HTMLInputElement).value })"
        /></label>
        <label
          >站点图标链接（可选）<input
            :value="value.linkedLink.favicon"
            maxlength="2048"
            @input="changeLink({ favicon: ($event.target as HTMLInputElement).value })"
        /></label>
      </div>
      <div class="moment-editor__row">
        <label
          >保存状态<select
            :value="value.status"
            aria-label="动态保存状态"
            @change="change('status', ($event.target as HTMLSelectElement).value as MomentStatus)"
          >
            <option value="draft">草稿</option>
            <option value="published">已发布</option>
            <option value="archived">已归档</option>
          </select></label
        >
        <label class="moment-editor__check"
          ><input
            :checked="value.isPinned"
            type="checkbox"
            @change="change('isPinned', ($event.target as HTMLInputElement).checked)"
          />置顶动态</label
        >
      </div>
    </fieldset>
    <AdminActionBar class="moment-editor__actions">
      <button type="submit" :disabled="!ready || loading || saving || !value.content.trim()">
        {{ saving ? '正在保存…' : '保存动态' }}
      </button>
      <button
        type="button"
        :disabled="!ready || loading || saving || !value.content.trim()"
        @click="$emit('save', 'draft')"
      >
        保存草稿
      </button>
      <button
        type="button"
        :disabled="!ready || loading || saving || !value.content.trim()"
        @click="$emit('save', 'published')"
      >
        发布动态
      </button>
      <span>{{ dirty ? '有尚未保存的输入' : saved ? '当前输入已保存' : '尚未保存' }}</span>
    </AdminActionBar>
    <ClientOnly><AdminMediaPicker v-model:open="mediaOpen" @selected="selectMedia" /></ClientOnly>
  </form>
</template>
<script setup lang="ts">
import type { ManagedMoment, MomentEditable, MomentLinkedLink, MomentStatus } from '~/features/moment/types'
import type { MomentRecovery } from '~/features/moment/editor'
import type { MediaAsset } from '~/features/media/types'
const props = defineProps<{
  value: MomentEditable
  id: string | null
  ready: boolean
  loading: boolean
  saving: boolean
  dirty: boolean
  saved: ManagedMoment | null
  serverVersion: ManagedMoment | null
  recovery: MomentRecovery | null
  error: string
  notice: string
  localError: string
  articleChoices: { id: number; title: string }[]
  articlesPending: boolean
  articlesError: string
}>()
const emit = defineEmits<{
  change: [value: Partial<MomentEditable>]
  save: [status: MomentStatus]
  reload: []
  restore: []
  discard: []
  persist: []
  'search-articles': [query: string]
}>()
const mediaOpen = ref(false),
  linkMode = ref('none'),
  articleSearch = ref('')
const statusText = { draft: '草稿', published: '已发布', archived: '已归档' }
function change<K extends keyof MomentEditable>(key: K, value: MomentEditable[K]) {
  emit('change', { [key]: value })
}
function changeLink(value: Partial<MomentLinkedLink>) {
  change('linkedLink', { url: '', title: '', ...props.value.linkedLink, ...value })
}
function setLinkMode(value: string) {
  linkMode.value = value
  emit('change', { linkedArticleId: null, linkedLink: value === 'link' ? { url: '', title: '' } : null })
  if (value === 'article') emit('search-articles', '')
}
function selectMedia(asset: MediaAsset) {
  if (props.value.images.length < 9 && !props.value.images.includes(asset.url))
    change('images', [...props.value.images, asset.url])
}
</script>
<style scoped lang="scss">
.moment-editor {
  max-width: 1050px;
  display: grid;
  gap: 1rem;
}
.moment-editor__heading,
.moment-editor__actions,
.moment-editor__row {
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
  display: grid;
  min-width: 0;
  gap: 1rem;
  padding: 0;
}
label {
  display: grid;
  gap: 0.4rem;
  min-width: 0;
}
.moment-editor__row > label {
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
  cursor: not-allowed;
  opacity: 0.55;
}
.moment-editor__check {
  display: flex;
  align-items: center;
}
.moment-editor__check input {
  width: auto;
}
.moment-editor__recovery {
  padding: 1rem;
  border: 1px solid var(--accent);
  border-radius: 0.5rem;
}
.moment-editor__recovery p,
blockquote {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.moment-editor__images {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 0.75rem;
  margin-top: 0.75rem;
}
figure {
  margin: 0;
  min-width: 0;
}
figure img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: 0.5rem;
}
.moment-editor__actions {
  padding: 1rem 0;
}
</style>
