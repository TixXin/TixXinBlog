/**
 * @file i18n-default-locale.ts
 * @description 把部署时的 NUXT_PUBLIC_DEFAULT_LOCALE 校验后映射为 i18n 模块的运行时默认语言，预构建镜像无需重新构建
 * @author TixXin
 * @since 2026-10-19
 */

import { resolveDefaultLocale } from '../../i18n/localeOptions'

export default defineNitroPlugin(() => {
  const configured = process.env.NUXT_PUBLIC_DEFAULT_LOCALE
  // 未设置时保留构建期取值（构建同样按该变量解析，缺省 zh-CN）。
  if (configured === undefined) return
  // Nitro 为每个请求复制运行时配置并重新套用 NUXT_ 环境变量；在启动阶段写入模块读取的变量，
  // 所有请求（含序列化给客户端的公开配置）都得到同一个已校验的默认语言，无效值回退 zh-CN。
  process.env.NUXT_PUBLIC_I18N_DEFAULT_LOCALE = resolveDefaultLocale(configured)
})
