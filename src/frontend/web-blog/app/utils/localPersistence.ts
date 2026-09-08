/**
 * @file localPersistence.ts
 * @description 本地写入失败必须显式传播；多键导入先留备份，失败恢复原值
 */
export function writeLocalJson(key: string, value: unknown): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    throw new Error('本地保存失败：浏览器存储不可用或空间不足，内容尚未保存')
  }
}

export function writeLocalBatch(entries: Array<[string, unknown]>): void {
  if (typeof window === 'undefined') return
  recoverLocalBatch()
  const snapshots = entries.map(([key]) => [key, localStorage.getItem(key)] as const)
  // 浏览器异常关闭后的恢复证据；备份保存失败时不开始覆盖原记录。
  const backupKey = 'tixxin-local-write-backup'
  writeLocalJson(backupKey, snapshots)
  try {
    for (const [key, value] of entries) writeLocalJson(key, value)
    localStorage.removeItem(backupKey)
  } catch (error) {
    try {
      for (const [key, raw] of snapshots) {
        if (raw === null) localStorage.removeItem(key)
        else localStorage.setItem(key, raw)
      }
      localStorage.removeItem(backupKey)
    } catch {
      throw new Error('本地保存失败，自动恢复未完成；请保留浏览器数据，原始备份仍在本机')
    }
    throw error
  }
}

/** 上次导入若被异常关闭中断，在下一次读取前恢复同一份原始数据。 */
export function recoverLocalBatch(): void {
  if (typeof window === 'undefined') return
  const key = 'tixxin-local-write-backup'
  const raw = localStorage.getItem(key)
  if (!raw) return
  try {
    const snapshots: unknown = JSON.parse(raw)
    if (!Array.isArray(snapshots) || snapshots.length > 10) throw new Error('backup')
    for (const item of snapshots) {
      if (
        !Array.isArray(item) ||
        item.length !== 2 ||
        typeof item[0] !== 'string' ||
        !/^tab:(?:categories|bookmarks):/.test(item[0]) ||
        (item[1] !== null && typeof item[1] !== 'string')
      ) {
        throw new Error('backup')
      }
    }
    for (const [target, value] of snapshots as Array<[string, string | null]>) {
      if (value === null) localStorage.removeItem(target)
      else localStorage.setItem(target, value)
    }
    localStorage.removeItem(key)
  } catch {
    throw new Error('上次本地导入未完成，备份恢复失败；请保留浏览器数据后重试')
  }
}
