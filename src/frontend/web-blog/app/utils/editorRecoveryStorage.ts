/** @file editorRecoveryStorage.ts @description 按内容上下文保留编辑副本，旧键迁移先核验目标写入，冲突副本分别保留 */
export interface EditorRecoveryCopy<T> {
  key: string
  value: T
}
export function editorRecoveryKey(prefix: string, context: string) {
  return `${prefix}:${encodeURIComponent(context)}`
}
export function readEditorRecoveries<T extends { context: string; savedAt: string }>(
  storage: Storage,
  prefix: string,
  context: string,
  parse: (raw: string | null) => T | null,
) {
  let migrationIssue = false
  const legacyRaw = storage.getItem(prefix),
    legacy = parse(legacyRaw)
  if (legacyRaw && legacy) {
    try {
      const base = editorRecoveryKey(prefix, legacy.context)
      let destination = base,
        index = 0
      while (storage.getItem(destination) !== null && storage.getItem(destination) !== legacyRaw) {
        destination = `${base}:preserved:${++index}`
      }
      if (storage.getItem(destination) !== legacyRaw) storage.setItem(destination, legacyRaw)
      // 写入失败、读回不一致或已有别的副本时，都不能先删除旧键。
      if (storage.getItem(destination) === legacyRaw) storage.removeItem(prefix)
      else migrationIssue = true
    } catch {
      migrationIssue = true
    }
  } else if (legacyRaw) migrationIssue = true
  const currentKey = editorRecoveryKey(prefix, context)
  const keys = Object.keys(storage).filter((key) => key === prefix || key.startsWith(`${prefix}:`))
  const copies: EditorRecoveryCopy<T>[] = []
  const seen = new Set<string>()
  for (const key of keys.sort((a, b) => Number(b === currentKey) - Number(a === currentKey))) {
    const raw = storage.getItem(key),
      value = parse(raw)
    if (!raw || !value || seen.has(raw)) continue
    seen.add(raw)
    copies.push({ key, value })
  }
  const current =
    copies.find((copy) => copy.key === currentKey && copy.value.context === context) ??
    copies.find((copy) => copy.key === prefix && copy.value.context === context) ??
    null
  return { current, previous: copies.filter((copy) => copy !== current), migrationIssue }
}
