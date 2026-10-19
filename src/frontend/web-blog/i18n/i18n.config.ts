/**
 * @file i18n.config.ts
 * @description vue-i18n 运行时选项：缺词回退到中文，避免英文字典漏词时界面出现裸 key
 * @author TixXin
 * @since 2026-10-19
 */

export default defineI18nConfig(() => ({
  fallbackLocale: 'zh-CN',
}))
