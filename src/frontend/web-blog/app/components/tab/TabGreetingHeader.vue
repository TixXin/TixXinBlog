<!--
  @file TabGreetingHeader.vue
  @description 标签页顶部问候语与日期时间展示
  @author TixXin
  @since 2026-04-11
-->

<template>
  <div v-if="settings.showGreeting || settings.showDate" class="tabs-page__greeting">
    <h1 v-if="settings.showGreeting" class="tabs-page__hello">{{ greetingLine }}</h1>
    <p v-if="settings.showDate" class="tabs-page__date">{{ today }}</p>
  </div>
</template>

<script setup lang="ts">
import type { TabSettings } from '~/composables/useTabSettings'
import type { CurrentUser } from '~/features/auth/types'
import { mockOwnerUser } from '~/features/auth/mock'
import { formatDate, formatDateTime } from '~/utils/format'

interface Props {
  settings: TabSettings
  currentUser?: CurrentUser | null
  isLoggedIn?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  currentUser: null,
  isLoggedIn: false,
})

const { t } = useI18n()

const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 6) return t('misc.tab.page.greeting.lateNight')
  if (h < 11) return t('misc.tab.page.greeting.morning')
  if (h < 14) return t('misc.tab.page.greeting.noon')
  if (h < 18) return t('misc.tab.page.greeting.afternoon')
  if (h < 22) return t('misc.tab.page.greeting.evening')
  return t('misc.tab.page.greeting.lateNight')
})

const greetingLine = computed(() => {
  if (!props.isLoggedIn) return t('misc.tab.page.guestWelcome', { name: mockOwnerUser.nickname })
  return t('misc.tab.page.greetingLine', { greeting: greeting.value, name: props.currentUser?.nickname ?? '' })
})

const today = computed(() => {
  const d = new Date()
  let str = t('misc.tab.page.date', {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    monthName: formatDate(d, { month: 'long' }),
    day: d.getDate(),
    weekday: formatDate(d, { weekday: 'long' }),
  })
  if (props.settings.showSeconds) {
    str += ` · ${formatDateTime(d, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
  }
  return str
})
</script>

<style lang="scss" scoped>
.tabs-page__greeting {
  text-align: center;
}

.tabs-page__hello {
  margin: 0 0 0.375rem;
  font-size: 1.625rem;
  font-weight: 700;
  color: var(--text-main);
  letter-spacing: -0.01em;
}

.tabs-page__date {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--text-soft);
}
</style>
