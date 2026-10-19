/**
 * @file useLocaleSwitch.ts
 * @description 访客切换界面语言：写入 blog-locale cookie 并就地切换字典，不整页重载
 * @author TixXin
 * @since 2026-10-19
 */
import { LOCALE_COOKIE_KEY, LOCALE_COOKIE_MAX_AGE, SUPPORTED_LOCALES, isSupportedLocale } from '~~/i18n/localeOptions'
import type { SupportedLocale } from '~~/i18n/localeOptions'

/** 语言选项的自称名称：各语言始终用本语言书写，便于看不懂当前界面的访客找到自己的语言 */
const LOCALE_NATIVE_NAMES: Record<SupportedLocale, string> = {
  'zh-CN': '简体中文',
  en: 'English',
}

export function useLocaleSwitch() {
  const { locale, setLocale } = useI18n()
  const cookie = useCookie<string | null>(LOCALE_COOKIE_KEY, {
    path: '/',
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: 'lax',
  })
  const switching = ref(false)
  const options = SUPPORTED_LOCALES.map((code) => ({ code, name: LOCALE_NATIVE_NAMES[code] }))

  /** 切换到指定语言并记住选择；同一语言或不受支持的值直接忽略 */
  async function switchLocale(code: string) {
    if (!isSupportedLocale(code) || code === locale.value) return
    switching.value = true
    try {
      await setLocale(code)
      // 字典加载并切换完成后才记住选择，失败时下次访问仍按原语言渲染。
      cookie.value = code
    } finally {
      switching.value = false
    }
  }

  return { locale, options, switching, switchLocale }
}
