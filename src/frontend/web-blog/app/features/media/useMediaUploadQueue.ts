/** @file useMediaUploadQueue.ts @description 媒体上传队列：选择或拖入文件、逐个上传与进度、失败重试和归属变化时终止 */
import type { ComputedRef, Ref } from 'vue'
import type { Translate } from '~/utils/format'
import { MEDIA_UPLOAD_LIMIT, isAcceptedMediaUpload, mediaErrorText } from './library'
import type { MediaWorkspace } from './useMediaWorkspace'

export interface MediaUploadJob {
  id: string
  name: string
  file?: File
  alt: string
  progress: number
  status: 'queued' | 'uploading' | 'processing' | 'done' | 'failed'
  error: string
}

function createUploadJob(file: File, alt: string, t: Translate): MediaUploadJob {
  const valid = isAcceptedMediaUpload(file)
  return {
    id: crypto.randomUUID(),
    name: file.name,
    file: valid ? markRaw(file) : undefined,
    alt,
    progress: 0,
    status: valid ? 'queued' : 'failed',
    error: valid ? '' : t('admin-media.mediaMessages.invalidFile'),
  }
}

/** 依次上传排队中的文件；全部结束后回到第一页重新读取 */
function createMediaUploadRunner(ctx: MediaWorkspace, jobs: Ref<MediaUploadJob[]>, load: () => Promise<void>) {
  const { uploading } = ctx
  /** 上传单个文件，返回 false 表示归属已变化、队列应停止 */
  async function uploadJob(job: MediaUploadJob, file: File, operation: number) {
    job.status = 'uploading'
    job.error = ''
    try {
      await ctx.uploader.upload(file, job.id, job.alt, (value) => {
        if (!ctx.ownsOperation(operation)) return
        job.progress = value
        job.status = value === 100 ? 'processing' : 'uploading'
      })
      if (!ctx.ownsOperation(operation)) return false
      job.status = 'done'
      job.file = undefined
    } catch (cause) {
      if (!ctx.ownsOperation(operation)) return false
      job.status = 'failed'
      job.error = mediaErrorText(cause, ctx.t)
    }
    return true
  }
  return async function runQueue() {
    if (uploading.value || !ctx.allowAction()) return
    const operation = ctx.guard.ownershipVersion
    uploading.value = true
    try {
      for (const job of jobs.value.filter((item) => item.status === 'queued')) {
        if (!ctx.ownsOperation(operation) || !job.file) break
        if (!(await uploadJob(job, job.file, operation))) break
      }
      if (ctx.ownsOperation(operation)) {
        ctx.page.value = 1
        await load()
      }
    } finally {
      uploading.value = false
    }
  }
}

export function createMediaUploadQueue(
  ctx: MediaWorkspace,
  hasDirtyMetadata: ComputedRef<boolean>,
  load: () => Promise<void>,
) {
  const { t, uploading, working, error } = ctx
  const uploadAlt = ref('')
  const jobs = ref<MediaUploadJob[]>([])
  const runQueue = createMediaUploadRunner(ctx, jobs, load)
  function enqueue(files: File[]) {
    if (!ctx.allowAction() || uploading.value || working.value) return
    if (hasDirtyMetadata.value) {
      error.value = t('admin-media.mediaMessages.saveDraftsFirst')
      return
    }
    if (files.length > MEDIA_UPLOAD_LIMIT) {
      error.value = t('admin-media.mediaMessages.tooManyFiles')
      return
    }
    for (const file of files) jobs.value.push(createUploadJob(file, uploadAlt.value, t))
    void runQueue()
  }
  function chooseFiles(event: Event) {
    const input = event.target as HTMLInputElement
    enqueue(Array.from(input.files ?? []))
    input.value = ''
  }
  const dropFiles = (event: DragEvent) => {
    if (!uploading.value) enqueue(Array.from(event.dataTransfer?.files ?? []))
  }
  function retry(job: MediaUploadJob) {
    if (ctx.allowAction() && jobs.value.includes(job) && job.file && !uploading.value) {
      job.status = 'queued'
      job.progress = 0
      void runQueue()
    }
  }
  /** 归属变化：未完成的任务标记失败，不再继续上传 */
  function failActiveJobs(message: string) {
    for (const job of jobs.value) {
      if (!job.file || !['queued', 'uploading', 'processing'].includes(job.status)) continue
      job.status = 'failed'
      job.error = message
    }
  }
  return { uploadAlt, jobs, chooseFiles, dropFiles, retry, failActiveJobs }
}
