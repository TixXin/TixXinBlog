/**
 * @file theme-host.d.ts
 * @description 构建期宿主主题元数据的类型声明
 * @author TixXin
 * @since 2026-09-07
 */
declare module '#build/theme-host.config.mjs' {
  export const themeHostConfigs: Record<string, import('~/features/appearance/themeRegistry').ThemeHostConfig>
}
