/** @file editorState.test.ts @description 编辑器通用工具回归：未保存改动检测、请求状态码与冲突后静默读取 */
import { expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { createDirtyTracker, readLatestQuietly, requestStatusCode } from '../../app/utils/editorState'

it('以快照比较表单与基线，可按当前表单或给定内容重设基线', () => {
  const form = reactive({ title: '初稿', tags: ['a'] })
  const tracker = createDirtyTracker(form)
  expect(tracker.dirty.value).toBe(false)
  form.tags.push('b')
  expect(tracker.dirty.value).toBe(true)
  tracker.markClean()
  expect(tracker.dirty.value).toBe(false)
  tracker.markClean({ title: '服务器版本', tags: [] })
  expect(tracker.dirty.value).toBe(true)
  expect(tracker.baseline.value).toBe('{"title":"服务器版本","tags":[]}')
})

it('读取请求错误的状态码，普通错误没有状态码', () => {
  expect(requestStatusCode(Object.assign(new Error('冲突'), { statusCode: 409 }))).toBe(409)
  expect(requestStatusCode(new Error('网络中断'))).toBeUndefined()
})

it('冲突后读取成功时应用最新版本，读取或应用失败都不再抛出', async () => {
  const apply = vi.fn()
  await readLatestQuietly(async () => ({ revision: 6 }), apply)
  expect(apply).toHaveBeenCalledWith({ revision: 6 })
  apply.mockClear()
  await expect(readLatestQuietly(async () => Promise.reject(new Error('离线')), apply)).resolves.toBeUndefined()
  expect(apply).not.toHaveBeenCalled()
  await expect(
    readLatestQuietly(
      async () => 1,
      () => {
        throw new Error('应用失败')
      },
    ),
  ).resolves.toBeUndefined()
})
