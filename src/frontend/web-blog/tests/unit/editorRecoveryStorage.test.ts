/** @file editorRecoveryStorage.test.ts @description 旧恢复键迁移、内容库隔离、冲突保留及存储失败时不丢失输入 */
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { editorRecoveryKey, readEditorRecoveries } from '../../app/utils/editorRecoveryStorage'
import { projectForm, parseProjectRecovery } from '../../app/features/project/editor'
const prefix = 'tixxin-project-editor:owner:1'
const copy = (context: string, title: string) => ({
  version: 1,
  context,
  id: 1,
  revision: 2,
  requestId: '12345678-1234-4123-a123-123456789abc',
  savedAt: '2026-09-10',
  pendingCreate: null,
  form: {
    ...projectForm(),
    title,
    progress: 'archived',
    tags: [{ label: 'UnstoredTech', color: 'rose' }],
    links: [{ kind: 'docs', href: 'https://example.com/OnlyInDraft?version=Original' }],
  },
})
beforeEach(() => sessionStorage.clear())
afterEach(() => vi.restoreAllMocks())
it('旧键移到原内容库命名空间，新内容库编辑不会覆盖全部旧字段', () => {
  const raw = JSON.stringify(copy('before', '旧内容库草稿'))
  sessionStorage.setItem(prefix, raw)
  const result = readEditorRecoveries(sessionStorage, prefix, 'restored', parseProjectRecovery)
  expect(result.current).toBeNull()
  expect(result.previous[0]?.value.form.links[0]?.href).toContain('version=Original')
  expect(sessionStorage.getItem(prefix)).toBeNull()
  sessionStorage.setItem(editorRecoveryKey(prefix, 'restored'), JSON.stringify(copy('restored', '恢复后输入')))
  expect(sessionStorage.getItem(editorRecoveryKey(prefix, 'before'))).toBe(raw)
})
it('原内容库已存在另一副本时两份都保留，重新读取不会增殖', () => {
  const legacy = JSON.stringify(copy('before', '旧键输入')),
    existing = JSON.stringify(copy('before', '已有独立输入'))
  sessionStorage.setItem(prefix, legacy)
  sessionStorage.setItem(editorRecoveryKey(prefix, 'before'), existing)
  const first = readEditorRecoveries(sessionStorage, prefix, 'restored', parseProjectRecovery)
  expect(first.previous.map((item) => item.value.form.title).sort()).toEqual(['已有独立输入', '旧键输入'].sort())
  const count = sessionStorage.length
  readEditorRecoveries(sessionStorage, prefix, 'restored', parseProjectRecovery)
  expect(sessionStorage.length).toBe(count)
})
it('迁移写入失败时保留旧键，仍可只读查看完整输入', () => {
  const raw = JSON.stringify(copy('before', '无法迁移的输入'))
  sessionStorage.setItem(prefix, raw)
  const write = vi.fn(() => {
    throw new DOMException('quota', 'QuotaExceededError')
  })
  const storage = new Proxy(sessionStorage, {
    get(target, key) {
      if (key === 'setItem') return write
      const value = Reflect.get(target, key, target)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
  const result = readEditorRecoveries(storage, prefix, 'restored', parseProjectRecovery)
  expect(write).toHaveBeenCalledOnce()
  expect(result.migrationIssue).toBe(true)
  expect(sessionStorage.getItem(prefix)).toBe(raw)
  expect(result.previous[0]?.value.form.tags).toEqual([{ label: 'UnstoredTech', color: 'rose' }])
})
