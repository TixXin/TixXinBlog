/**
 * @file useMediaUpload.ts
 * @description 上传固定账号与内容代次，真实传输进度及同标识重试；取消不丢弃调用方文件。
 */
import type { MediaAsset } from '~/features/media/types'

export function useMediaUpload() {
  const auth = useCurrentUser()
  const pageContext = useState<string>('page-content-context', () => '')
  const active = new Set<XMLHttpRequest>()
  let disposed = false
  let cancellation = 0
  const ownershipError = () =>
    Object.assign(new Error('登录账号或内容库已变化，文件仍保留，请核对后重试'), { statusCode: 409 })
  async function upload(file: File, id: string, alt: string, progress: (value: number) => void) {
    const startedActor = auth.currentUser.value?.id
    const context = pageContext.value
    const startedCancellation = cancellation
    const assertActive = () => {
      if (disposed || startedCancellation !== cancellation) throw new Error('上传已取消，已选择的文件仍保留')
    }
    assertActive()
    const restored = await auth.restore()
    assertActive()
    const actor = auth.currentUser.value?.id
    if ((startedActor && actor !== startedActor) || pageContext.value !== context) throw ownershipError()
    if (!restored || !actor) throw new Error('请重新登录后重试，已选择的文件仍保留')
    const assertOwnership = () => {
      assertActive()
      if (auth.currentUser.value?.id !== actor || pageContext.value !== context) throw ownershipError()
    }
    const send = (): Promise<MediaAsset> => {
      assertOwnership()
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        active.add(xhr)
        let settled = false
        const finish = (complete: () => void) => {
          if (settled) return
          settled = true
          active.delete(xhr)
          xhr.onload = xhr.onerror = xhr.ontimeout = xhr.onabort = null
          xhr.upload.onprogress = null
          try {
            assertOwnership()
            complete()
          } catch (cause) {
            reject(cause)
          }
        }
        try {
          xhr.open('POST', '/api/v1/admin/media')
          xhr.withCredentials = true
          xhr.responseType = 'json'
          xhr.timeout = 60000
          if (auth.accessToken.value) xhr.setRequestHeader('Authorization', `Bearer ${auth.accessToken.value}`)
          if (context) xhr.setRequestHeader('X-Content-Context', context)
          xhr.upload.onprogress = (event) => {
            try {
              assertOwnership()
              if (event.lengthComputable) progress(Math.round((event.loaded / event.total) * 100))
            } catch (cause) {
              finish(() => reject(cause))
              xhr.abort()
            }
          }
          xhr.onload = () =>
            finish(() => {
              if (xhr.status >= 200 && xhr.status < 300 && xhr.response?.data) resolve(xhr.response.data)
              else
                reject(
                  Object.assign(
                    new Error(typeof xhr.response?.message === 'string' ? xhr.response.message : '上传失败，请重试'),
                    { statusCode: xhr.status },
                  ),
                )
            })
          xhr.onerror = () => finish(() => reject(new Error('网络上传失败，文件仍保留，可重试')))
          xhr.ontimeout = () => finish(() => reject(new Error('上传超时，可使用相同文件重试')))
          xhr.onabort = () => finish(() => reject(new Error('上传已取消，已选择的文件仍保留')))
          const form = new FormData()
          form.append('file', file, file.name)
          form.append('uploadId', id)
          form.append('alt', alt)
          xhr.send(form)
        } catch (cause) {
          finish(() => reject(cause))
        }
      })
    }
    try {
      return await send()
    } catch (error) {
      assertOwnership()
      if ((error as { statusCode?: number }).statusCode === 401) {
        const refreshed = await auth.refresh()
        assertOwnership()
        if (refreshed) return send()
      }
      throw error
    }
  }
  function cancel() {
    cancellation++
    for (const xhr of [...active]) xhr.abort()
  }
  onBeforeUnmount(() => {
    disposed = true
    cancel()
  })
  return { upload, cancel }
}
