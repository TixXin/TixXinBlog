/**
 * @file sessionTypes.ts
 * @description 活跃管理会话的最小展示信息，不包含令牌、完整设备指纹或 IP。
 */
export interface AdminSessionItem {
  id: string
  device: string
  loginAt?: string
  createdAt: string
  lastRefreshedAt: string
  expiresAt: string
  current: boolean
}
