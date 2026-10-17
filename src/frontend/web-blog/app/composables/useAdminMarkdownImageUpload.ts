/**
 * @file useAdminMarkdownImageUpload.ts
 * @description 后台 Markdown 正文粘贴/拖拽图片上传：在光标处插入唯一占位，经媒体库接口上传后替换为标准图片语法，
 * 失败替换为可见错误并提示；类型与大小限制与后端 normalizeImage 一致，纯文本粘贴保持浏览器原行为。
 *
 * 撤销栈取舍：占位插入在文本框聚焦时优先用 execCommand('insertText')，可被 Ctrl/⌘+Z 撤销；
 * 上传完成后的替换发生在异步回调里，用户可能已移走焦点，因此用 setRangeText 定位替换并派发 input 事件同步 v-model，
 * 不抢焦点、不移动用户当前光标。浏览器不会把 setRangeText 记入撤销栈，此后撤销可能越过这次替换，这是可接受的代价。
 */
import type { Ref } from 'vue'
import type { MediaAsset } from '~/features/media/types'

/** 与后端 MAX_IMAGE_BYTES 一致 */
export const MARKDOWN_IMAGE_MAX_BYTES = 8 * 1024 * 1024
/** 与后端文件名与魔数校验一致：仅 JPEG、PNG、WebP */
const IMAGE_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
const EXTENSION = /\.(?:jpe?g|png|webp)$/i
/** 剪贴板截图常见的无意义文件名，不适合作为替代文本 */
const GENERIC_NAME =
  /^(?:image|img|clipboard|pasted[ _-]?(?:image|graphic)|screenshot|截图|屏幕截图|粘贴的图片)[\s_\-\d.()]*$/i

export interface PreparedImage {
  file: File
  alt: string
}

/** 只取受支持类型的图片文件；其余（含非图片）返回原因，便于提示 */
export function prepareImageFiles(files: File[]) {
  const accepted: PreparedImage[] = []
  const rejected: { name: string; reason: string }[] = []
  for (const file of files) {
    const extension = IMAGE_TYPES[file.type]
    const name = file.name || 'image'
    if (!extension && !EXTENSION.test(name)) {
      rejected.push({ name, reason: '仅支持 JPEG、PNG 和 WebP 图片' })
      continue
    }
    if (!file.size || file.size > MARKDOWN_IMAGE_MAX_BYTES) {
      rejected.push({ name, reason: '图片需不超过 8MB' })
      continue
    }
    // 后端拒绝控制字符、路径分隔符与双向控制符，且要求受支持扩展名；粘贴的文件可能没有合法名称。
    const cleaned = [...name]
      .filter((char) => {
        const code = char.charCodeAt(0)
        return (
          code >= 32 &&
          code !== 127 &&
          char !== '\\' &&
          char !== '/' &&
          !(code >= 0x202a && code <= 0x202e) &&
          !(code >= 0x2066 && code <= 0x2069)
        )
      })
      .join('')
      .trim()
      .slice(-200)
    const base = cleaned.replace(/\.[^.]*$/, '').trim()
    const safeName = EXTENSION.test(cleaned) ? cleaned : `${base || 'image'}.${extension ?? 'png'}`
    accepted.push({
      file: safeName === file.name ? file : new File([file], safeName, { type: file.type }),
      alt: base && !GENERIC_NAME.test(base) ? base.slice(0, 300) : '',
    })
  }
  return { accepted, rejected }
}

/** Markdown 图片替代文本转义，与 MediaPicker 插入保持一致 */
export function markdownImage(alt: string, url: string) {
  return `![${alt.replace(/[[\]\\]/g, '\\$&').replace(/\r?\n/g, ' ')}](${url})`
}

function imageFiles(list: FileList | DataTransferItemList | null | undefined) {
  if (!list) return []
  const files: File[] = []
  for (const entry of Array.from(list as ArrayLike<File | DataTransferItem>)) {
    const file = entry instanceof File ? entry : entry.kind === 'file' ? entry.getAsFile() : null
    if (file) files.push(file)
  }
  return files
}

export function useAdminMarkdownImageUpload(
  textarea: Ref<HTMLTextAreaElement | null | undefined>,
  options: { disabled?: () => boolean } = {},
) {
  const uploader = useMediaUpload()
  const { error: toastError, success, info } = useToast()
  const uploading = ref(0)
  const status = ref('')

  /** 在当前选区插入文本；聚焦时走 insertText 以保留撤销，否则退回 setRangeText */
  function insertAtSelection(element: HTMLTextAreaElement, text: string) {
    const start = element.selectionStart ?? element.value.length
    const end = element.selectionEnd ?? start
    if (document.activeElement !== element) element.focus()
    let inserted: boolean
    try {
      inserted = typeof document.execCommand === 'function' && document.execCommand('insertText', false, text)
    } catch {
      inserted = false
    }
    if (!inserted || element.value.slice(start, start + text.length) !== text) {
      element.setRangeText(text, start, end, 'end')
      element.dispatchEvent(new Event('input', { bubbles: true }))
    }
  }

  /** 定位唯一占位并替换；占位被用户删除时返回 false */
  function replaceToken(token: string, replacement: string) {
    const element = textarea.value
    if (!element?.isConnected) return false
    const index = element.value.indexOf(token)
    if (index < 0) return false
    element.setRangeText(replacement, index, index + token.length, 'preserve')
    element.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  }

  async function uploadFiles(files: File[]) {
    const element = textarea.value
    if (!element || !files.length) return
    const { accepted, rejected } = prepareImageFiles(files)
    for (const item of rejected) toastError(`${item.name}：${item.reason}`)
    if (!accepted.length) return
    const jobs = accepted.map((item) => {
      const id = crypto.randomUUID()
      return { ...item, id, token: `![上传中…](uploading:${id.slice(0, 8)})` }
    })
    // 多张图片各占一行，占位标识唯一，用户继续输入也能准确定位替换位置。
    insertAtSelection(element, jobs.map((job) => job.token).join('\n'))
    uploading.value += jobs.length
    status.value = `正在上传 ${uploading.value} 张图片`
    let missingAlt = 0
    await Promise.all(
      jobs.map(async (job) => {
        try {
          const asset: MediaAsset = await uploader.upload(job.file, job.id, job.alt, () => {})
          const alt = job.alt || asset.alt
          if (!alt) missingAlt++
          if (!replaceToken(job.token, markdownImage(alt, asset.url)))
            info(`${job.file.name} 已上传到媒体库，但正文中的占位已被删除，未插入图片`)
        } catch (cause) {
          const message = cause instanceof Error ? cause.message : '上传失败，请重试'
          replaceToken(job.token, `![上传失败：${job.file.name.replace(/[[\]\\]/g, '')}（${message}）]()`)
          toastError(`${job.file.name} 上传失败：${message}`)
        } finally {
          uploading.value--
        }
      }),
    )
    status.value = uploading.value ? `正在上传 ${uploading.value} 张图片` : '图片上传处理完成'
    if (missingAlt) info(`有 ${missingAlt} 张图片没有替代文本，请在方括号中补充图片描述`)
    else if (jobs.length) success(`已插入 ${jobs.length} 张图片`)
  }

  function blocked() {
    return options.disabled?.() === true
  }

  /** 剪贴板含图片文件时接管粘贴；纯文本或同时带文本的富内容（如从网页复制）保持原行为 */
  function onPaste(event: ClipboardEvent) {
    const data = event.clipboardData
    if (!data || blocked()) return
    const files = imageFiles(data.files?.length ? data.files : data.items).filter((file) =>
      file.type.startsWith('image/'),
    )
    if (!files.length || data.getData('text/plain')) return
    event.preventDefault()
    void uploadFiles(files)
  }
  function onDragOver(event: DragEvent) {
    if (blocked() || !event.dataTransfer?.types?.includes('Files')) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }
  function onDrop(event: DragEvent) {
    const files = imageFiles(event.dataTransfer?.files)
    if (!files.length) return
    // 拖入文件时始终阻止浏览器打开图片；禁用时只拦截，不上传。
    event.preventDefault()
    if (blocked()) return
    void uploadFiles(files)
  }

  return { uploading, status, onPaste, onDragOver, onDrop, uploadFiles }
}
