/**
 * @file types.ts
 * @description 后台版本信息的数据结构，与 server/routes/api/releases.json.ts 的响应一致
 * @author TixXin
 * @since 2026-11-06
 */

export interface ReleaseItem {
  version: string
  prerelease: boolean
  publishedAt: string | null
  url: string
  notes: string
  migration: boolean
  current: boolean
  newer: boolean
}

export interface ReleaseSummary {
  current: string | null
  channel: 'stable' | 'beta'
  items: ReleaseItem[]
  latest: string | null
  checkedAt: string | null
  error: boolean
}

/** 一键安装站点的升级命令；版本号只来自 Release 列表，仍按格式校验后再拼接 */
export function upgradeCommand(version: string): string {
  return /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version) ? `sudo tixxin update ${version}` : ''
}
