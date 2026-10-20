<!--
  @file MediaLibrary.vue
  @description 媒体库与选择器共用：上传进度、检索、资料编辑、引用查看和批量回收恢复。
-->
<template>
  <section class="media-library">
    <div class="media-library__drop" @dragover.prevent @drop.prevent="dropFiles">
      <p>{{ $t('admin-media.mediaLibrary.uploadRules') }}</p>
      <p>{{ $t('admin-media.mediaLibrary.uploadPrivacy') }}</p>
      <label
        >{{ $t('admin-media.mediaLibrary.chooseFiles')
        }}<input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          :disabled="uploading || working || !ready"
          @change="chooseFiles"
      /></label>
      <label
        >{{ $t('admin-media.mediaLibrary.defaultAlt')
        }}<input v-model="uploadAlt" maxlength="300" :disabled="uploading || working || !ready"
      /></label>
    </div>
    <ul v-if="jobs.length" class="media-library__jobs">
      <li v-for="job in jobs" :key="job.id">
        <span class="media-library__job-name"
          >{{ job.name }} ·
          {{
            job.status === 'done'
              ? $t('admin-media.mediaLibrary.job.done')
              : job.status === 'processing'
                ? $t('admin-media.mediaLibrary.job.processing')
                : job.status === 'failed'
                  ? $t('admin-media.mediaLibrary.job.failed')
                  : job.status === 'queued'
                    ? $t('admin-media.mediaLibrary.job.queued')
                    : $t('admin-media.mediaLibrary.job.uploading', { progress: job.progress })
          }}</span
        >
        <progress
          v-if="job.status === 'uploading' || job.status === 'processing'"
          :value="job.progress"
          max="100"
          :aria-label="$t('admin-media.mediaLibrary.job.progressLabel', { name: job.name })"
        />
        <span v-if="job.error" role="alert">{{ job.error }}</span
        ><button
          v-if="job.status === 'failed' && job.file"
          type="button"
          :disabled="uploading || working || !ready"
          @click="retry(job)"
        >
          {{ $t('admin-media.mediaLibrary.job.retry') }}
        </button>
      </li>
    </ul>
    <form class="media-library__filters" @submit.prevent="searchMedia">
      <input
        v-model="search"
        class="media-library__search"
        :disabled="!ready || working"
        :placeholder="$t('admin-media.mediaLibrary.searchPlaceholder')"
        :aria-label="$t('admin-media.mediaLibrary.searchLabel')"
        maxlength="128"
      /><select
        v-if="!selectable"
        v-model="deleted"
        :disabled="!ready || working"
        :aria-label="$t('admin-media.mediaLibrary.stateLabel')"
        @change="searchMedia"
      >
        <option value="false">{{ $t('admin-media.mediaLibrary.stateAvailable') }}</option>
        <option value="true">{{ $t('admin-media.mediaLibrary.stateDeleted') }}</option></select
      ><select
        v-model="orientation"
        :disabled="!ready || working || hasDirtyMetadata"
        :aria-label="$t('admin-media.mediaLibrary.orientationLabel')"
        @change="searchMedia"
      >
        <option value="">{{ $t('admin-media.mediaLibrary.orientationAll') }}</option>
        <option value="landscape">{{ $t('admin-media.mediaLibrary.orientationLandscape') }}</option>
        <option value="portrait">{{ $t('admin-media.mediaLibrary.orientationPortrait') }}</option>
        <option value="square">{{ $t('admin-media.mediaLibrary.orientationSquare') }}</option></select
      ><select
        v-model="usage"
        :disabled="!ready || working || hasDirtyMetadata"
        :aria-label="$t('admin-media.mediaLibrary.usageLabel')"
        @change="searchMedia"
      >
        <option value="">{{ $t('admin-media.mediaLibrary.usageAll') }}</option>
        <option value="used">{{ $t('admin-media.mediaLibrary.usageUsed') }}</option>
        <option value="unused">{{ $t('admin-media.mediaLibrary.usageUnused') }}</option></select
      ><button :aria-busy="pending" type="submit" :disabled="pending || !ready || working">
        {{ $t('admin-media.mediaLibrary.search') }}
      </button>
    </form>
    <p>{{ $t('admin-media.mediaLibrary.usageHint') }}</p>
    <p v-if="error" role="alert">
      {{ error }}
      <button type="button" :disabled="pending || working" @click="load">
        {{ $t('admin-media.mediaLibrary.reload') }}
      </button>
    </p>
    <p v-if="pending" role="status">{{ $t('admin-media.mediaLibrary.loading') }}</p>
    <section
      v-if="referenceId"
      class="media-library__references"
      :aria-labelledby="referenceHeadingId"
      :aria-busy="referenceLoading"
      @keydown.esc.stop.prevent="closeReferences"
    >
      <h3 :id="referenceHeadingId" ref="referenceHeading" tabindex="-1">
        {{ $t('admin-media.mediaLibrary.references.heading', { name: referenceName })
        }}<span v-if="references">{{
          $t('admin-media.mediaLibrary.references.count', { total: references.total })
        }}</span>
      </h3>
      <p>{{ $t('admin-media.mediaLibrary.references.hint') }}</p>
      <button type="button" @click="closeReferences">{{ $t('admin-media.mediaLibrary.references.close') }}</button>
      <p v-if="referenceLoading" role="status">{{ $t('admin-media.mediaLibrary.references.loading') }}</p>
      <p v-else-if="referenceError" role="alert">
        {{ referenceError }}
        <button type="button" :disabled="!ready || working" @click="refreshReferences()">
          {{ $t('admin-media.mediaLibrary.references.retry') }}
        </button>
      </p>
      <template v-else-if="references">
        <p v-if="!references.total">{{ $t('admin-media.mediaLibrary.references.none') }}</p>
        <ul v-else class="media-library__reference-list">
          <li v-for="(item, index) in references.items" :key="index">
            <NuxtLink :to="item.url">{{ item.title }}</NuxtLink> · {{ referenceLabel(item) }}
          </li>
        </ul>
        <div v-if="references.total" class="media-library__reference-pagination">
          <button
            type="button"
            :disabled="!ready || working || references.page <= 1"
            @click="refreshReferences(references.page - 1)"
          >
            {{ $t('admin-media.mediaLibrary.references.previous') }}
          </button>
          <span>{{ references.page }} / {{ Math.max(1, Math.ceil(references.total / references.pageSize)) }}</span>
          <button
            type="button"
            :disabled="!ready || working || references.page * references.pageSize >= references.total"
            @click="refreshReferences(references.page + 1)"
          >
            {{ $t('admin-media.mediaLibrary.references.next') }}
          </button>
        </div>
      </template>
    </section>
    <div v-if="!selectable && deleted === 'false'" class="media-library__batch">
      <label class="media-library__selection">
        <CommonTooltip :content="$t('admin-media.mediaLibrary.batch.selectHint')">
          <input
            type="checkbox"
            :checked="allSelected"
            :indeterminate="someSelected"
            :disabled="!canBatchSelect || !items.length"
            @change="toggleAll"
          />
        </CommonTooltip>
        {{ $t('admin-media.mediaLibrary.batch.selectAll') }}
      </label>
      <span role="status">{{ $t('admin-media.mediaLibrary.batch.selected', { count: selectedIds.length }) }}</span>
      <button type="button" :disabled="!canBatchSelect || !selectedIds.length" @click="clearSelection">
        {{ $t('admin-media.mediaLibrary.batch.clear') }}
      </button>
      <CommonTooltip :content="$t('admin-media.mediaLibrary.batch.removeHint')">
        <button
          type="button"
          :disabled="!canBatchSelect || !selectedIds.length"
          :aria-describedby="batchHint ? batchHintId : undefined"
          @click="removeSelected"
        >
          <Icon name="lucide:trash-2" aria-hidden="true" />
          {{ $t('admin-media.mediaLibrary.batch.remove') }}
        </button>
      </CommonTooltip>
      <!-- 禁用原因常驻显示，读屏通过 aria-describedby 获知按钮不可用的原因 -->
      <p v-if="batchHint" :id="batchHintId" class="media-library__batch-hint">{{ batchHint }}</p>
    </div>
    <p v-if="batchProgress" role="status">
      {{
        $t('admin-media.mediaLibrary.batch.progress', {
          completed: batchProgress.completed,
          total: batchProgress.total,
        })
      }}
    </p>
    <!-- 完成后只播报一条汇总，逐项结果不整体实时播报，避免读屏重复朗读整块列表 -->
    <p v-if="batchSummary" role="status" class="media-library__batch-summary">{{ batchSummary }}</p>
    <section
      v-if="batchResults.length"
      class="media-library__results"
      :aria-label="$t('admin-media.mediaLibrary.batch.resultsTitle')"
    >
      <h3>{{ $t('admin-media.mediaLibrary.batch.resultsTitle') }}</h3>
      <ul>
        <li v-for="result in batchResults" :key="result.id">
          <p>
            <strong>{{ result.name }}</strong> · {{ $t(removalStatusKeys[result.status]) }}
          </p>
          <p>{{ result.message }}</p>
          <template v-if="result.status === 'referenced'">
            <ul v-if="result.references?.items.length" class="media-library__reference-list">
              <li v-for="(item, index) in result.references.items" :key="index">
                <NuxtLink :to="item.url">{{ item.title }}</NuxtLink> · {{ referenceLabel(item) }}
              </li>
            </ul>
            <button type="button" :disabled="!ready || working" @click="openReferences(result.id, $event)">
              {{ $t('admin-media.mediaLibrary.references.viewAll')
              }}<span v-if="result.references">{{
                $t('admin-media.mediaLibrary.references.count', { total: result.references.total })
              }}</span>
            </button>
          </template>
        </li>
      </ul>
    </section>
    <p v-if="!pending && !error && !items.length">{{ $t('admin-media.mediaLibrary.empty') }}</p>
    <ul class="media-library__grid">
      <li v-for="asset in items" :key="asset.id" class="media-library__card">
        <label v-if="!selectable && deleted === 'false' && !asset.deleted" class="media-library__selection">
          <input
            type="checkbox"
            :checked="selectedIds.includes(asset.id)"
            :disabled="!canBatchSelect"
            :aria-label="$t('admin-media.mediaLibrary.asset.select', { name: asset.name })"
            @change="toggleSelection(asset)"
          />
          {{ $t('admin-media.mediaLibrary.asset.selectLabel') }}
        </label>
        <img v-if="!asset.deleted" :src="asset.url" :alt="asset.alt || asset.name" loading="lazy" />
        <div v-else class="media-library__removed">
          <Icon name="lucide:image-off" />{{ $t('admin-media.mediaLibrary.asset.removed') }}
        </div>
        <strong class="media-library__asset-name">{{ asset.name }}</strong>
        <p>
          {{
            $t('admin-media.mediaLibrary.asset.size', {
              width: asset.width,
              height: asset.height,
              size: Math.ceil(asset.byteSize / 1024),
            })
          }}
        </p>
        <label
          >{{ $t('admin-media.mediaLibrary.asset.alt')
          }}<input
            v-model="altDrafts[asset.id]"
            :aria-label="$t('admin-media.mediaLibrary.asset.altLabel', { name: asset.name })"
            maxlength="300"
            :disabled="!ready || asset.deleted || working"
        /></label>
        <label
          >{{ $t('admin-media.mediaLibrary.asset.description')
          }}<textarea
            v-model="descriptionDrafts[asset.id]"
            :aria-label="$t('admin-media.mediaLibrary.asset.descriptionLabel', { name: asset.name })"
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
            {{ $t('admin-media.mediaLibrary.asset.saveAlt') }}
          </button>
          <button
            v-if="altDrafts[asset.id] !== asset.alt"
            type="button"
            :disabled="!ready || working"
            @click="altDrafts[asset.id] = asset.alt"
          >
            {{ $t('admin-media.mediaLibrary.asset.cancelAlt') }}
          </button>
          <button
            v-if="!asset.deleted"
            type="button"
            :disabled="!ready || working || descriptionDrafts[asset.id] === asset.description"
            @click="saveDescription(asset)"
          >
            {{ $t('admin-media.mediaLibrary.asset.saveDescription') }}
          </button>
          <button
            v-if="descriptionDrafts[asset.id] !== asset.description"
            type="button"
            :disabled="!ready || working"
            @click="descriptionDrafts[asset.id] = asset.description"
          >
            {{ $t('admin-media.mediaLibrary.asset.cancelDescription') }}
          </button>
          <button type="button" :disabled="!ready || working" @click="openReferences(asset.id, $event)">
            {{ $t('admin-media.mediaLibrary.asset.references') }}
          </button>
          <button v-if="asset.deleted" type="button" :disabled="!ready || working" @click="restore(asset)">
            {{ $t('admin-media.mediaLibrary.asset.restore') }}
          </button>
          <button v-else type="button" :disabled="!ready || working || uploading" @click="remove(asset)">
            {{ $t('admin-media.mediaLibrary.asset.remove') }}
          </button>
          <button
            v-if="selectable && !asset.deleted"
            type="button"
            :disabled="!canSelect(asset)"
            @click="select(asset)"
          >
            {{ $t('admin-media.mediaLibrary.asset.use') }}
          </button>
        </div>
      </li>
    </ul>
    <div class="media-library__pagination">
      <button type="button" :disabled="!ready || pending || working || page <= 1" @click="changePage(page - 1)">
        {{ $t('admin-media.mediaLibrary.pagination.previous') }}</button
      ><span class="media-library__page-summary">{{
        $t('admin-media.mediaLibrary.pagination.summary', { page, pages: Math.max(1, Math.ceil(total / 20)), total })
      }}</span
      ><button
        type="button"
        :disabled="!ready || pending || working || page * 20 >= total"
        @click="changePage(page + 1)"
      >
        {{ $t('admin-media.mediaLibrary.pagination.next') }}
      </button>
    </div>
  </section>
</template>
<script setup lang="ts">
import { computed, nextTick, ref, useId, watch } from 'vue'
import type { MediaAsset, MediaReferences, MediaRemovalResult } from '~/features/media/types'
import type { useMediaLibrary } from '~/composables/useMediaLibrary'
const props = defineProps<{ selectable: boolean; controller: ReturnType<typeof useMediaLibrary> }>()
const emit = defineEmits<{ selected: [asset: MediaAsset] }>()
const { t } = useI18n()
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
/** 批量回收完成后的汇总；处理中由进度状态播报 */
const batchSummary = computed(() => {
  if (batchProgress.value || !batchResults.value.length) return ''
  const count = (status: MediaRemovalResult['status']) =>
    batchResults.value.filter((result) => result.status === status).length
  return t('admin-media.mediaLibrary.batch.summary', {
    removed: count('removed'),
    referenced: count('referenced'),
    failed: count('failed'),
  })
})
const batchHintId = `media-batch-hint-${useId()}`
/** 批量回收不可用时的原因，按优先级给出可操作的说明 */
const batchHint = computed(() => {
  if (canBatchSelect.value) return selectedIds.value.length ? '' : t('admin-media.mediaLibrary.batch.hintNoSelection')
  if (!ready.value || pending.value) return t('admin-media.mediaLibrary.batch.hintLoading')
  if (working.value || uploading.value) return t('admin-media.mediaLibrary.batch.hintBusy')
  if (jobs.value.some((job) => !!job.file)) return t('admin-media.mediaLibrary.batch.hintPendingJobs')
  if (hasDirtyMetadata.value) return t('admin-media.mediaLibrary.batch.hintDirty')
  return t('admin-media.mediaLibrary.batch.hintOwnership')
})
const referenceHeading = ref<HTMLElement | null>(null)
const referenceHeadingId = `media-references-${useId()}`
let referenceTrigger: HTMLElement | null = null
const referenceLabelKeys: Record<MediaReferences['items'][number]['kind'], string> = {
  post: 'admin-media.mediaLibrary.kind.post',
  revision: 'admin-media.mediaLibrary.kind.revision',
  flash: 'admin-media.mediaLibrary.kind.flash',
  site: 'admin-media.mediaLibrary.kind.site',
  'site-revision': 'admin-media.mediaLibrary.kind.siteRevision',
  comment: 'admin-media.mediaLibrary.kind.comment',
  'flash-comment': 'admin-media.mediaLibrary.kind.flashComment',
  moment: 'admin-media.mediaLibrary.kind.moment',
  'moment-comment': 'admin-media.mediaLibrary.kind.momentComment',
  guestbook: 'admin-media.mediaLibrary.kind.guestbook',
  gallery: 'admin-media.mediaLibrary.kind.gallery',
  project: 'admin-media.mediaLibrary.kind.project',
  link: 'admin-media.mediaLibrary.kind.link',
  'image-prompt': 'admin-media.mediaLibrary.kind.imagePrompt',
  subscription: 'admin-media.mediaLibrary.kind.subscription',
}
const removalStatusKeys: Record<MediaRemovalResult['status'], string> = {
  removed: 'admin-media.mediaLibrary.removal.removed',
  referenced: 'admin-media.mediaLibrary.removal.referenced',
  failed: 'admin-media.mediaLibrary.removal.failed',
}
// 只有历史版本引用带版本号；当前内容的引用记录 revision 为 null，不能拼进标签。
function referenceLabel(item: MediaReferences['items'][number]) {
  const label = t(referenceLabelKeys[item.kind])
  const versioned = item.kind === 'revision' || item.kind === 'site-revision'
  return versioned && item.revision != null
    ? t('admin-media.mediaLibrary.references.versioned', { label, revision: item.revision })
    : label
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
.media-library {
  min-width: 0;
  max-width: 100%;
  overflow-wrap: anywhere;
}
.media-library__drop {
  border: 2px dashed var(--border);
  padding: 1rem;
  border-radius: 0.8rem;
  margin: 1rem 0;
}
label {
  display: grid;
  min-width: 0;
  gap: 0.4rem;
  margin: 0.7rem 0;
}
p {
  color: var(--text-muted);
  margin: 0.5rem 0;
}

textarea {
  width: 100%;
  resize: vertical;
}

ul {
  list-style: none;
  padding: 0;
}
.media-library__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 220px), 1fr));
  gap: 1rem;
}
.media-library__grid > li,
.media-library__card,
.media-library__references,
.media-library__results {
  min-width: 0;
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
.media-library__reference-pagination,
.media-library__pagination,
.media-library__batch {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  margin: 0.8rem 0;
}
.media-library__batch-hint {
  flex-basis: 100%;
  margin: 0;
  font-size: 0.8125rem;
  color: var(--text-muted);
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
.media-library__search {
  flex: 1 1 15rem;
}
.media-library__asset-name,
.media-library__job-name {
  min-width: 0;
  overflow-wrap: anywhere;
}
.media-library__asset-name {
  display: block;
}
.media-library__jobs li {
  display: grid;
  min-width: 0;
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
  // 窄屏筛选独占一行，避免原生控件按内容宽度挤出容器。
  .media-library__filters {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }
  .media-library__filters > * {
    width: 100%;
  }
  .media-library__grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .media-library__actions > button,
  .media-library__reference-pagination > button {
    flex: 1 1 8rem;
  }
  .media-library__pagination {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .media-library__page-summary {
    grid-column: 1 / -1;
    grid-row: 1;
    text-align: center;
  }
}
</style>
