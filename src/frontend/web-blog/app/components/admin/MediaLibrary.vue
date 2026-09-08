<!--
  @file MediaLibrary.vue
  @description 媒体库与选择器共用：上传进度、重试、检索、替代文本、引用和回收恢复。
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
          :disabled="uploading || !ready"
          @change="chooseFiles"
      /></label>
      <label>新图片默认替代文本<input v-model="uploadAlt" maxlength="300" :disabled="uploading || !ready" /></label>
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
        ><button v-if="job.status === 'failed' && job.file" type="button" :disabled="uploading" @click="retry(job)">
          重试上传
        </button>
      </li>
    </ul>
    <form class="media-library__filters" @submit.prevent="searchMedia">
      <input v-model="search" placeholder="搜索文件名或替代文本" aria-label="搜索媒体" maxlength="128" /><select
        v-if="!selectable"
        v-model="deleted"
        aria-label="资源状态"
        @change="searchMedia"
      >
        <option value="false">可用资源</option>
        <option value="true">回收资源</option></select
      ><button type="submit" :disabled="pending">搜索</button>
    </form>
    <p v-if="error" role="alert">
      {{ error }} <button type="button" :disabled="pending" @click="load">重新加载</button>
    </p>
    <p v-if="pending" role="status">正在读取媒体…</p>
    <section v-if="references" class="media-library__references" aria-label="媒体引用">
      <h3>引用位置（{{ references.total }}）</h3>
      <p>包含草稿、归档和历史修订；只有没有引用的资源才能移除。</p>
      <button type="button" @click="references = null">关闭引用</button>
      <ul>
        <li v-for="(item, index) in references.items" :key="index">
          <NuxtLink :to="item.url">{{ item.title }}</NuxtLink> ·
          {{
            item.kind === 'revision' || item.kind === 'site-revision'
              ? `历史版本 ${item.revision}`
              : item.kind === 'post'
                ? '当前文章'
                : item.kind === 'site'
                  ? '站点设置'
                  : item.kind === 'comment' || item.kind === 'flash-comment'
                    ? '评论头像'
                    : '闪念'
          }}
        </li>
      </ul>
      <button
        type="button"
        :disabled="working || references.page <= 1"
        @click="showReferences(referenceId, references.page - 1)"
      >
        上一页引用</button
      ><button
        type="button"
        :disabled="working || references.page * 20 >= references.total"
        @click="showReferences(referenceId, references.page + 1)"
      >
        下一页引用
      </button>
    </section>
    <p v-if="!pending && !error && !items.length">暂无媒体资源</p>
    <ul class="media-library__grid">
      <li v-for="asset in items" :key="asset.id">
        <img v-if="!asset.deleted" :src="asset.url" :alt="asset.alt || asset.name" loading="lazy" />
        <div v-else class="media-library__removed"><Icon name="lucide:image-off" />已移入回收</div>
        <strong>{{ asset.name }}</strong>
        <p>{{ asset.width }} × {{ asset.height }} · {{ Math.ceil(asset.byteSize / 1024) }} KB</p>
        <label
          >替代文本<input
            v-model="altDrafts[asset.id]"
            :aria-label="`${asset.name} 替代文本`"
            maxlength="300"
            :disabled="asset.deleted || working"
        /></label>
        <div class="media-library__actions">
          <button
            v-if="!asset.deleted"
            type="button"
            :disabled="working || altDrafts[asset.id] === asset.alt"
            @click="saveAlt(asset)"
          >
            保存替代文本
          </button>
          <button
            v-if="altDrafts[asset.id] !== asset.alt"
            type="button"
            :disabled="working"
            @click="altDrafts[asset.id] = asset.alt"
          >
            取消替代文本修改
          </button>
          <button type="button" :disabled="working" @click="showReferences(asset.id)">查看引用</button>
          <button v-if="asset.deleted" type="button" :disabled="working" @click="restore(asset)">恢复资源</button>
          <button v-else type="button" :disabled="working || uploading" @click="remove(asset)">移入回收</button>
          <button
            v-if="selectable && !asset.deleted"
            type="button"
            :disabled="working || pending || uploading || hasDirtyAlt"
            @click="$emit('selected', asset)"
          >
            使用此图片
          </button>
        </div>
      </li>
    </ul>
    <div class="media-library__pagination">
      <button type="button" :disabled="pending || page <= 1" @click="changePage(page - 1)">上一页资源</button
      ><span>{{ page }} / {{ Math.max(1, Math.ceil(total / 20)) }} · 共 {{ total }} 项</span
      ><button type="button" :disabled="pending || page * 20 >= total" @click="changePage(page + 1)">下一页资源</button>
    </div>
  </section>
</template>
<script setup lang="ts">
import type { MediaAsset } from '~/features/media/types'
import type { useMediaLibrary } from '~/composables/useMediaLibrary'
const props = defineProps<{ selectable: boolean; controller: ReturnType<typeof useMediaLibrary> }>()
defineEmits<{ selected: [asset: MediaAsset] }>()
const {
  search,
  deleted,
  page,
  total,
  items,
  altDrafts,
  hasDirtyAlt,
  uploadAlt,
  jobs,
  pending,
  ready,
  working,
  uploading,
  error,
  references,
  referenceId,
  load,
  searchMedia,
  changePage,
  chooseFiles,
  dropFiles,
  retry,
  saveAlt,
  showReferences,
  remove,
  restore,
} = props.controller
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
select,
button {
  padding: 0.55rem;
  color: var(--text-main);
  background: var(--surface-1);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  min-width: 0;
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
.media-library__references {
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
.media-library__pagination {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  margin: 0.8rem 0;
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
