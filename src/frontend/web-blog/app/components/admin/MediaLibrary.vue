<!--
  @file MediaLibrary.vue
  @description 媒体库与选择器共用：上传进度、检索、资料编辑、引用查看和批量回收恢复。
-->
<template>
  <section class="media-library">
    <div class="media-library__drop" @dragover.prevent @drop.prevent="dropFiles">
      <p>支持静态 JPEG、PNG、WebP，单张不超过 8MB；上传后优化为 WebP 并移除元信息。</p>
      <p>资源链接可公开访问。原文件保留在你的电脑中。</p>
      <label
        >选择或拖入图片<input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          :disabled="uploading || working || !ready"
          @change="chooseFiles"
      /></label>
      <label
        >新图片默认替代文本<input v-model="uploadAlt" maxlength="300" :disabled="uploading || working || !ready"
      /></label>
    </div>
    <ul v-if="jobs.length" class="media-library__jobs">
      <li v-for="job in jobs" :key="job.id">
        <span
          >{{ job.name }} ·
          {{
            job.status === 'done'
              ? '上传完成'
              : job.status === 'processing'
                ? '正在校验和处理图片'
                : job.status === 'failed'
                  ? '上传失败'
                  : job.status === 'queued'
                    ? '等待上传'
                    : `上传 ${job.progress}%`
          }}</span
        >
        <progress
          v-if="job.status === 'uploading' || job.status === 'processing'"
          :value="job.progress"
          max="100"
          :aria-label="`${job.name} 上传进度`"
        />
        <span v-if="job.error" role="alert">{{ job.error }}</span
        ><button
          v-if="job.status === 'failed' && job.file"
          type="button"
          :disabled="uploading || working || !ready"
          @click="retry(job)"
        >
          重试上传
        </button>
      </li>
    </ul>
    <form class="media-library__filters" @submit.prevent="searchMedia">
      <input
        v-model="search"
        :disabled="!ready || working"
        placeholder="搜索文件名、替代文本或素材说明"
        aria-label="搜索媒体"
        maxlength="128"
      /><select
        v-if="!selectable"
        v-model="deleted"
        :disabled="!ready || working"
        aria-label="资源状态"
        @change="searchMedia"
      >
        <option value="false">可用资源</option>
        <option value="true">回收资源</option></select
      ><select
        v-model="orientation"
        :disabled="!ready || working || hasDirtyMetadata"
        aria-label="媒体构图"
        @change="searchMedia"
      >
        <option value="">全部构图</option>
        <option value="landscape">横向图片</option>
        <option value="portrait">竖向图片</option>
        <option value="square">方形图片</option></select
      ><select
        v-model="usage"
        :disabled="!ready || working || hasDirtyMetadata"
        aria-label="媒体使用状态"
        @change="searchMedia"
      >
        <option value="">全部使用状态</option>
        <option value="used">已使用（含历史版本）</option>
        <option value="unused">尚未使用</option></select
      ><button :aria-busy="pending" type="submit" :disabled="pending || !ready || working">搜索</button>
    </form>
    <p>“已使用”包含草稿、归档、评论和历史版本引用；修改素材说明不会改变引用关系。</p>
    <p v-if="error" role="alert">
      {{ error }} <button type="button" :disabled="pending || working" @click="load">重新加载</button>
    </p>
    <p v-if="pending" role="status">正在读取媒体…</p>
    <section
      v-if="referenceId"
      class="media-library__references"
      :aria-labelledby="referenceHeadingId"
      :aria-busy="referenceLoading"
      @keydown.esc.stop.prevent="closeReferences"
    >
      <h3 :id="referenceHeadingId" ref="referenceHeading" tabindex="-1">
        {{ referenceName }} · 引用位置<span v-if="references">（{{ references.total }}）</span>
      </h3>
      <p>包含草稿、归档和历史修订；只有没有引用的资源才能移除。</p>
      <button type="button" @click="closeReferences">关闭引用</button>
      <p v-if="referenceLoading" role="status">正在读取引用位置…</p>
      <p v-else-if="referenceError" role="alert">
        {{ referenceError }}
        <button type="button" :disabled="!ready || working" @click="refreshReferences()">重新读取引用</button>
      </p>
      <template v-else-if="references">
        <p v-if="!references.total">该资源当前没有内容或历史版本引用。</p>
        <ul v-else class="media-library__reference-list">
          <li v-for="(item, index) in references.items" :key="index">
            <NuxtLink :to="item.url">{{ item.title }}</NuxtLink> · {{ referenceLabel(item) }}
          </li>
        </ul>
        <div v-if="references.total" class="media-library__pagination">
          <button
            type="button"
            :disabled="!ready || working || references.page <= 1"
            @click="refreshReferences(references.page - 1)"
          >
            上一页引用
          </button>
          <span>{{ references.page }} / {{ Math.max(1, Math.ceil(references.total / references.pageSize)) }}</span>
          <button
            type="button"
            :disabled="!ready || working || references.page * references.pageSize >= references.total"
            @click="refreshReferences(references.page + 1)"
          >
            下一页引用
          </button>
        </div>
      </template>
    </section>
    <div v-if="!selectable && deleted === 'false'" class="media-library__batch">
      <label class="media-library__selection">
        <CommonTooltip content="仅选择当前页；翻页、筛选或刷新后会清空选择。">
          <input
            type="checkbox"
            :checked="allSelected"
            :indeterminate="someSelected"
            :disabled="!canBatchSelect || !items.length"
            @change="toggleAll"
          />
        </CommonTooltip>
        全选本页
      </label>
      <span role="status">已选择 {{ selectedIds.length }} 项</span>
      <button type="button" :disabled="!canBatchSelect || !selectedIds.length" @click="clearSelection">清空选择</button>
      <CommonTooltip content="被当前内容或历史版本引用的媒体会保留，并列出引用位置。">
        <button type="button" :disabled="!canBatchSelect || !selectedIds.length" @click="removeSelected">
          <Icon name="lucide:trash-2" aria-hidden="true" />
          批量移入回收
        </button>
      </CommonTooltip>
    </div>
    <p v-if="batchProgress" role="status">
      正在处理所选资源：{{ batchProgress.completed }} / {{ batchProgress.total }}
    </p>
    <section v-if="batchResults.length" class="media-library__results" aria-label="批量回收结果" aria-live="polite">
      <h3>批量回收结果</h3>
      <ul>
        <li v-for="result in batchResults" :key="result.id">
          <p>
            <strong>{{ result.name }}</strong> · {{ removalStatusLabels[result.status] }}
          </p>
          <p>{{ result.message }}</p>
          <template v-if="result.status === 'referenced'">
            <ul v-if="result.references?.items.length" class="media-library__reference-list">
              <li v-for="(item, index) in result.references.items" :key="index">
                <NuxtLink :to="item.url">{{ item.title }}</NuxtLink> · {{ referenceLabel(item) }}
              </li>
            </ul>
            <button type="button" :disabled="!ready || working" @click="openReferences(result.id, $event)">
              查看全部引用<span v-if="result.references">（{{ result.references.total }}）</span>
            </button>
          </template>
        </li>
      </ul>
    </section>
    <p v-if="!pending && !error && !items.length">暂无媒体资源</p>
    <ul class="media-library__grid">
      <li v-for="asset in items" :key="asset.id">
        <label v-if="!selectable && deleted === 'false' && !asset.deleted" class="media-library__selection">
          <input
            type="checkbox"
            :checked="selectedIds.includes(asset.id)"
            :disabled="!canBatchSelect"
            :aria-label="`选择 ${asset.name}`"
            @change="toggleSelection(asset)"
          />
          选择此资源
        </label>
        <img v-if="!asset.deleted" :src="asset.url" :alt="asset.alt || asset.name" loading="lazy" />
        <div v-else class="media-library__removed"><Icon name="lucide:image-off" />已移入回收</div>
        <strong>{{ asset.name }}</strong>
        <p>{{ asset.width }} × {{ asset.height }} · {{ Math.ceil(asset.byteSize / 1024) }} KB</p>
        <label
          >替代文本<input
            v-model="altDrafts[asset.id]"
            :aria-label="`${asset.name} 替代文本`"
            maxlength="300"
            :disabled="!ready || asset.deleted || working"
        /></label>
        <label
          >素材说明<textarea
            v-model="descriptionDrafts[asset.id]"
            :aria-label="`${asset.name} 素材说明`"
            maxlength="1000"
            rows="3"
            :disabled="!ready || asset.deleted || working"
          />
        </label>
        <div class="media-library__actions">
          <button
            v-if="!asset.deleted"
            type="button"
            :disabled="!ready || working || altDrafts[asset.id] === asset.alt"
            @click="saveAlt(asset)"
          >
            保存替代文本
          </button>
          <button
            v-if="altDrafts[asset.id] !== asset.alt"
            type="button"
            :disabled="!ready || working"
            @click="altDrafts[asset.id] = asset.alt"
          >
            取消替代文本修改
          </button>
          <button
            v-if="!asset.deleted"
            type="button"
            :disabled="!ready || working || descriptionDrafts[asset.id] === asset.description"
            @click="saveDescription(asset)"
          >
            保存素材说明
          </button>
          <button
            v-if="descriptionDrafts[asset.id] !== asset.description"
            type="button"
            :disabled="!ready || working"
            @click="descriptionDrafts[asset.id] = asset.description"
          >
            取消素材说明修改
          </button>
          <button type="button" :disabled="!ready || working" @click="openReferences(asset.id, $event)">
            查看引用
          </button>
          <button v-if="asset.deleted" type="button" :disabled="!ready || working" @click="restore(asset)">
            恢复资源
          </button>
          <button v-else type="button" :disabled="!ready || working || uploading" @click="remove(asset)">
            移入回收
          </button>
          <button
            v-if="selectable && !asset.deleted"
            type="button"
            :disabled="!canSelect(asset)"
            @click="select(asset)"
          >
            使用此图片
          </button>
        </div>
      </li>
    </ul>
    <div class="media-library__pagination">
      <button type="button" :disabled="!ready || pending || working || page <= 1" @click="changePage(page - 1)">
        上一页资源</button
      ><span>{{ page }} / {{ Math.max(1, Math.ceil(total / 20)) }} · 共 {{ total }} 项</span
      ><button
        type="button"
        :disabled="!ready || pending || working || page * 20 >= total"
        @click="changePage(page + 1)"
      >
        下一页资源
      </button>
    </div>
  </section>
</template>
<script setup lang="ts">
import { nextTick, ref, useId, watch } from 'vue'
import type { MediaAsset, MediaReferences, MediaRemovalResult } from '~/features/media/types'
import type { useMediaLibrary } from '~/composables/useMediaLibrary'
const props = defineProps<{ selectable: boolean; controller: ReturnType<typeof useMediaLibrary> }>()
const emit = defineEmits<{ selected: [asset: MediaAsset] }>()
function select(asset: MediaAsset) {
  if (props.controller.canSelect(asset)) emit('selected', asset)
}
const {
  search,
  deleted,
  orientation,
  usage,
  page,
  total,
  items,
  altDrafts,
  descriptionDrafts,
  hasDirtyMetadata,
  canSelect,
  uploadAlt,
  jobs,
  pending,
  ready,
  working,
  uploading,
  error,
  references,
  referenceId,
  referenceName,
  referenceLoading,
  referenceError,
  selectedIds,
  allSelected,
  someSelected,
  canBatchSelect,
  batchResults,
  batchProgress,
  load,
  searchMedia,
  changePage,
  chooseFiles,
  dropFiles,
  retry,
  saveAlt,
  saveDescription,
  showReferences,
  closeReferences,
  toggleSelection,
  toggleAll,
  clearSelection,
  removeSelected,
  remove,
  restore,
} = props.controller
const referenceHeading = ref<HTMLElement | null>(null)
const referenceHeadingId = `media-references-${useId()}`
let referenceTrigger: HTMLElement | null = null
const referenceLabels: Record<MediaReferences['items'][number]['kind'], string> = {
  post: '当前文章',
  revision: '文章历史版本',
  flash: '闪念',
  site: '站点设置',
  'site-revision': '站点历史版本',
  comment: '评论头像',
  'flash-comment': '闪念评论头像',
  moment: '朋友圈动态',
  'moment-comment': '动态评论',
  guestbook: '留言',
  gallery: '图库作品',
  project: '项目封面',
  link: '友链 Logo',
  'image-prompt': '图片提示词',
  subscription: '平台订阅图标',
}
const removalStatusLabels: Record<MediaRemovalResult['status'], string> = {
  removed: '已移入回收',
  referenced: '因引用而保留',
  failed: '处理失败',
}
function referenceLabel(item: MediaReferences['items'][number]) {
  const label = referenceLabels[item.kind]
  return item.revision === undefined ? label : `${label} ${item.revision}`
}
function openReferences(id: string, event: Event) {
  referenceTrigger = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
  void showReferences(id)
  void nextTick(() => referenceHeading.value?.focus())
}
function refreshReferences(targetPage = 1) {
  void showReferences(referenceId.value, targetPage)
  void nextTick(() => referenceHeading.value?.focus())
}
// 引用面板的加载、失败与翻页使用同一标题，关闭时把键盘焦点还给入口。
watch(referenceId, async (id, previousId) => {
  if (id && id !== previousId) {
    if (!referenceTrigger?.isConnected) {
      referenceTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    }
    await nextTick()
    referenceHeading.value?.focus()
  } else if (!id && previousId) {
    await nextTick()
    if (referenceTrigger?.isConnected) referenceTrigger.focus()
    referenceTrigger = null
  }
})
</script>
<style scoped lang="scss">
.media-library__drop {
  border: 2px dashed var(--border);
  padding: 1rem;
  border-radius: 0.8rem;
  margin: 1rem 0;
}
label {
  display: grid;
  gap: 0.4rem;
  margin: 0.7rem 0;
}
p {
  color: var(--text-muted);
  margin: 0.5rem 0;
}
input,
textarea,
select,
button {
  padding: 0.55rem;
  color: var(--text-main);
  background: var(--surface-1);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  min-width: 0;
}
textarea {
  width: 100%;
  resize: vertical;
}
button:disabled {
  opacity: 0.5;
}
input[type='file'] {
  max-width: 100%;
}
ul {
  list-style: none;
  padding: 0;
}
.media-library__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1rem;
}
.media-library__grid > li,
.media-library__references,
.media-library__results {
  border: 1px solid var(--border);
  padding: 1rem;
  border-radius: 0.8rem;
  background: var(--surface-2);
  overflow-wrap: anywhere;
}
.media-library__grid img,
.media-library__removed {
  width: 100%;
  height: 150px;
  object-fit: contain;
  margin-bottom: 0.75rem;
}
.media-library__removed {
  display: grid;
  place-content: center;
  color: var(--text-muted);
}
.media-library__actions,
.media-library__filters,
.media-library__pagination,
.media-library__batch {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  margin: 0.8rem 0;
}
.media-library__selection {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.media-library__selection input {
  width: 1.1rem;
  height: 1.1rem;
  flex: none;
  accent-color: var(--accent);
}
.media-library__reference-list {
  display: grid;
  gap: 0.5rem;
  margin: 0.75rem 0;
}
.media-library__results > ul > li + li {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border);
}
:is(input, textarea, select, button, a):focus-visible,
.media-library__references h3:focus {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}
.media-library__jobs li {
  display: grid;
  gap: 0.4rem;
  padding: 0.7rem 0;
}
progress {
  width: 100%;
}
a {
  color: var(--accent);
}
@media (max-width: 500px) {
  .media-library__grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
