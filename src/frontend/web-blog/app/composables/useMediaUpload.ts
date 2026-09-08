/**
 * @file useMediaUpload.ts
 * @description 使用真实传输事件报告上传进度，同一上传标识支持失败重试。
 */
import type { MediaAsset } from '~/features/media/types'

export function useMediaUpload() {
  const auth = useCurrentUser()
  const pageContext = useState<string>('page-content-context', () => '')
  let active: XMLHttpRequest | null = null
  let disposed = false
  function send(file: File, id: string, alt: string, progress: (value: number) => void): Promise<MediaAsset> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      active = xhr
      xhr.open('POST', '/api/v1/admin/media')
      xhr.withCredentials = true
      xhr.responseType = 'json'
      xhr.timeout = 60000
      if (auth.accessToken.value) xhr.setRequestHeader('Authorization', `Bearer ${auth.accessToken.value}`)
      if (pageContext.value) xhr.setRequestHeader('X-Content-Context', pageContext.value)
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) progress(Math.round((event.loaded / event.total) * 100))
      }
      xhr.onload = () => {
        active = null
        if (xhr.status >= 200 && xhr.status < 300 && xhr.response?.data) resolve(xhr.response.data)
        else
          reject(
            Object.assign(
              new Error(typeof xhr.response?.message === 'string' ? xhr.response.message : '上传失败，请重试'),
              { statusCode: xhr.status },
            ),
          )
      }
      xhr.onerror = () => {
        active = null
        reject(new Error('网络上传失败，文件仍保留，可重试'))
      }
      xhr.ontimeout = () => {
        active = null
        reject(new Error('上传超时，可使用相同文件重试'))
      }
      xhr.onabort = () => {
        active = null
        reject(new Error('上传已取消'))
      }
      const form = new FormData()
      form.append('file', file, file.name)
      form.append('uploadId', id)
      form.append('alt', alt)
      xhr.send(form)
    })
  }
  async function upload(file: File, id: string, alt: string, progress: (value: number) => void) {
    if (disposed) throw new Error('上传面板已关闭')
    if (!(await auth.restore())) throw new Error('请重新登录后重试，已选择的文件仍保留')
    try {
      return await send(file, id, alt, progress)
    } catch (error) {
      if ((error as { statusCode?: number }).statusCode === 401 && (await auth.refresh()) && !disposed)
        return send(file, id, alt, progress)
      throw error
    }
  }
  onBeforeUnmount(() => {
    disposed = true
    active?.abort()
  })
  return { upload }
}
