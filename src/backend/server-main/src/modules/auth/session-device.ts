/**
 * @file session-device.ts
 * @description 仅保存粗略系统/浏览器类别，不持久化完整 User-Agent 或 IP。
 */
export function sessionDeviceLabel(agent = ''): string {
  const ua = agent.slice(0, 1024)
  const system = /Windows/i.test(ua)
    ? 'Windows'
    : /Android/i.test(ua)
      ? 'Android'
      : /iPhone|iPad|iPod/i.test(ua)
        ? 'iOS'
        : /Macintosh|Mac OS X/i.test(ua)
          ? 'macOS'
          : /Linux/i.test(ua)
            ? 'Linux'
            : '未知系统'
  const browser = /Edg\//i.test(ua)
    ? 'Edge'
    : /Firefox\//i.test(ua)
      ? 'Firefox'
      : /Chrome\/|Chromium\//i.test(ua)
        ? 'Chrome'
        : /Safari\//i.test(ua)
          ? 'Safari'
          : '未知客户端'
  return `${system} · ${browser}`
}
