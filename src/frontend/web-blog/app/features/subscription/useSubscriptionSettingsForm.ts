/** @file useSubscriptionSettingsForm.ts @description 后台订阅设置表单：参考汇率的版本化保存，以及续费日历链接的生成、停用与复制 */
import { validateRates } from '@tixxin/subscription-domain'
import { currencyOptions } from './types'
import type { AdminSubscriptionSettings, SubscriptionCurrency } from './types'
import { subscriptionErrorMessage } from './labels'
import type { Translate } from '~/utils/format'

interface SettingsForm {
  baseCurrency: SubscriptionCurrency | null
  rates: Partial<Record<SubscriptionCurrency, string>>
  ratesUpdatedAt: string | null
}
type Repository = ReturnType<typeof useSubscriptionRepository>
interface SettingsState {
  repo: Repository
  t: Translate
  saved: Ref<AdminSubscriptionSettings | null>
  form: Ref<SettingsForm | null>
  saving: Ref<boolean>
  message: Ref<string>
}

function accept(state: SettingsState, value: AdminSubscriptionSettings) {
  state.saved.value = value
  state.form.value = {
    baseCurrency: value.baseCurrency,
    rates: { ...value.rates },
    ratesUpdatedAt: value.ratesUpdatedAt,
  }
}
/** 串行执行一次设置写入：成功采用返回值并提示，失败给出可读原因 */
async function run(
  state: SettingsState,
  task: () => Promise<AdminSubscriptionSettings>,
  success: string,
  fallback: string,
) {
  if (state.saving.value) return
  state.saving.value = true
  state.message.value = ''
  try {
    accept(state, await task())
    state.message.value = state.t(success)
  } catch (cause) {
    state.message.value = subscriptionErrorMessage(cause, state.t) ?? state.t(fallback)
  } finally {
    state.saving.value = false
  }
}

function useRatesActions(state: SettingsState, today: Ref<string>) {
  function saveRates() {
    const value = state.form.value,
      current = state.saved.value
    if (!value || !current) return
    // 空输入视为不填该币种汇率；提交前用领域规则校验，避免往返后端才发现格式错误。
    const rates = Object.fromEntries(
      Object.entries(value.rates).filter(([code, rate]) => rate && code !== value.baseCurrency),
    )
    try {
      if (value.baseCurrency) validateRates({ base: value.baseCurrency, rates })
    } catch (cause) {
      state.message.value =
        subscriptionErrorMessage(cause, state.t) ?? state.t('admin-media.subscriptionSettings.saveFailed')
      return
    }
    return run(
      state,
      () =>
        state.repo.saveSettings({
          revision: current.revision,
          baseCurrency: value.baseCurrency,
          rates: value.baseCurrency ? rates : {},
          ratesUpdatedAt: value.baseCurrency ? (value.ratesUpdatedAt ?? today.value) : null,
        }),
      'admin-media.subscriptionSettings.saved',
      'admin-media.subscriptionSettings.saveFailed',
    )
  }
  const otherCurrencies = computed(() => currencyOptions.filter((code) => code !== state.form.value?.baseCurrency))
  return { saveRates, otherCurrencies }
}

function useCalendarActions(state: SettingsState) {
  const apiBase = String(useRuntimeConfig().public.apiBaseUrl).replace(/\/$/, '')
  // 令牌原文只在生成时返回一次，刷新页面后不再显示
  const token = ref('')
  const calendarEnabled = computed(() => !!state.saved.value?.calendarEnabled)
  const calendarUrl = computed(() =>
    token.value && import.meta.client
      ? new URL(
          `${apiBase}/subscriptions/calendar.ics?token=${encodeURIComponent(token.value)}`,
          window.location.origin,
        ).href
      : '',
  )
  const webcalUrl = computed(() => calendarUrl.value.replace(/^https?:/, 'webcal:'))
  const fail = 'admin-media.subscriptionSettings.calendarFailed'
  function rotate() {
    if (calendarEnabled.value && !window.confirm(state.t('admin-media.subscriptionSettings.rotateConfirm'))) return
    const task = async () => {
      const result = await state.repo.rotateCalendar()
      token.value = result.token
      return result
    }
    return run(state, task, 'admin-media.subscriptionSettings.rotated', fail)
  }
  function disable() {
    if (!window.confirm(state.t('admin-media.subscriptionSettings.disableConfirm'))) return
    token.value = ''
    return run(state, () => state.repo.disableCalendar(), 'admin-media.subscriptionSettings.disabledNotice', fail)
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(calendarUrl.value)
      state.message.value = state.t('admin-media.subscriptionSettings.copied')
    } catch {
      state.message.value = state.t('admin-media.subscriptionSettings.copyFailed')
    }
  }
  return { calendarEnabled, calendarUrl, webcalUrl, rotate, disable, copy }
}

export function useSubscriptionSettingsForm() {
  const { t } = useI18n()
  const state: SettingsState = {
    repo: useSubscriptionRepository(),
    t,
    saved: ref(null),
    form: ref(null),
    saving: ref(false),
    message: ref(''),
  }
  const loading = ref(false),
    loadError = ref('')
  async function load() {
    loading.value = true
    loadError.value = ''
    try {
      accept(state, await state.repo.adminSettings())
    } catch (cause) {
      loadError.value = subscriptionErrorMessage(cause, t) ?? t('admin-media.subscriptionSettings.loadFailed')
    } finally {
      loading.value = false
    }
  }
  onMounted(load)
  const summary = computed(() => {
    const value = state.saved.value
    if (!value) return ''
    const rates = value.baseCurrency
      ? t('admin-media.subscriptionSettings.summaryRates', { base: value.baseCurrency })
      : t('admin-media.subscriptionSettings.summaryNoRates')
    const calendar = t(`admin-media.subscriptionSettings.${value.calendarEnabled ? 'calendarOn' : 'calendarOff'}`)
    return `${rates} · ${calendar}`
  })
  return {
    form: state.form,
    saving: state.saving,
    message: state.message,
    loading,
    loadError,
    summary,
    load,
    ...useRatesActions(state, useSubscriptionToday()),
    ...useCalendarActions(state),
  }
}
