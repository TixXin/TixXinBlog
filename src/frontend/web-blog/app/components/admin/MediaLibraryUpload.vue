<!--
  @file MediaLibraryUpload.vue
  @description 媒体库的上传区：选择或拖入文件、默认替代文本，以及上传队列的状态、进度与失败重试
-->
<template>
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
</template>
<script setup lang="ts">
import type { useMediaLibrary } from '~/composables/useMediaLibrary'
const props = defineProps<{ controller: ReturnType<typeof useMediaLibrary> }>()
const { uploadAlt, jobs, ready, working, uploading, chooseFiles, dropFiles, retry } = props.controller
</script>
<style scoped lang="scss">
@use '~/assets/styles/media-library' as media;
@include media.base;
.media-library__drop {
  border: 2px dashed var(--border);
  padding: 1rem;
  border-radius: 0.8rem;
  margin: 1rem 0;
}
.media-library__job-name {
  min-width: 0;
  overflow-wrap: anywhere;
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
</style>
