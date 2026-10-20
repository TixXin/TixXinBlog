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

  // 切换按点击顺序串行执行：字典加载中再选回原语言时，等前一次完成后再切回，界面与最后一次选择一致
  let queue: Promise<void> = Promise.resolve()
  let pending = 0

  /** 切换到指定语言并记住选择；同一语言或不受支持的值直接忽略 */
  function switchLocale(code: string): Promise<void> {
    if (!isSupportedLocale(code)) return Promise.resolve()
    pending += 1
    switching.value = true
    const run = queue.then(async () => {
      if (code === locale.value) return
      await setLocale(code)
      // 字典加载并切换完成后才记住选择，失败时下次访问仍按原语言渲染。
      cookie.value = code
    })
    queue = run
      .catch(() => {})
      .finally(() => {
        pending -= 1
        if (!pending) switching.value = false
      })
    return run
  }

  return { locale, options, switching, switchLocale }
}
