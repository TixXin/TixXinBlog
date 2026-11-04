/**
 * @file 02.release-header.ts
 * @description 下发应用版本头 X-TixXin-Release，供安装、升级与 status 验收核对实际运行的版本；
 *   由前端输出而非入口代理，使自带 Caddy 与面板反代两种部署形态的判定一致。未配置版本（本机开发、静态发布）时不下发。
 */
export default defineEventHandler((event) => {
  const version = String(useRuntimeConfig(event).releaseVersion || '').trim()
  if (version) setResponseHeader(event, 'x-tixxin-release', version)
})
