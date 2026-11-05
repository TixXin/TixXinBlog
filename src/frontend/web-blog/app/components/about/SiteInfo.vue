<!--
  @file SiteInfo.vue
  @description 关于页“关于本站”：运行天数、上线日期、内容统计与当前版本。统计来自公开文章元数据（实际记录），
               读取失败时只显示不依赖统计的行，不用演示数字顶替
-->
<template>
  <section class="site-info" aria-labelledby="about-site-info-title">
    <h2 id="about-site-info-title" class="site-info__title">
      <Icon name="lucide:info" size="18" /> {{ $t('misc.about.siteInfo.title') }}
    </h2>
    <p v-if="stats || launchedLabel" class="site-info__lead">
      <span v-if="stats">{{
        $t('misc.about.siteInfo.days', { days: formatNumber(stats.siteAgeDays) }, stats.siteAgeDays)
      }}</span>
      <span v-if="stats && launchedLabel" aria-hidden="true"> · </span>
      <span v-if="launchedLabel">{{ launchedLabel }}</span>
    </p>
    <dl class="site-info__grid">
      <div v-for="item in items" :key="item.label" class="site-info__item">
        <dt class="site-info__label">{{ item.label }}</dt>
        <dd class="site-info__value">{{ item.value }}</dd>
      </div>
    </dl>
  </section>
</template>

<script setup lang="ts">
import { formatNumber } from '~/utils/format'

const { t, locale } = useI18n()
const { settings } = useSiteSettings()
const { siteStats } = await usePostMetadata()
const stats = computed(() => siteStats.value)
const version = useRuntimeConfig().public.appVersion as string
const launchedLabel = computed(() => {
  const day = settings.value.launchedAt
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return ''
  const date = new Intl.DateTimeFormat(locale.value, { dateStyle: 'long', timeZone: 'UTC' }).format(
    new Date(`${day}T00:00:00Z`),
  )
  return t('misc.about.siteInfo.launched', { date })
})
const items = computed(() => [
  ...(stats.value
    ? [
        { label: t('misc.about.siteInfo.articles'), value: formatNumber(stats.value.articles) },
        { label: t('misc.about.siteInfo.comments'), value: formatNumber(stats.value.comments) },
        { label: t('misc.about.siteInfo.tags'), value: formatNumber(stats.value.tags) },
        { label: t('misc.about.siteInfo.views'), value: stats.value.views },
      ]
    : []),
  ...(version ? [{ label: t('misc.about.siteInfo.version'), value: `v${version}` }] : []),
])
</script>

<style lang="scss" scoped>
.site-info {
  margin-block: 2rem;
}

.site-info__title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 1rem;
}

.site-info__lead {
  margin: 0 0 0.75rem;
  font-size: 0.875rem;
  color: var(--text-muted);
}

.site-info__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 7.5rem), 1fr));
  gap: 0.75rem;
  margin: 0;
}

.site-info__item {
  display: flex;
  flex-direction: column-reverse;
  gap: 0.25rem;
  padding: 0.75rem 1rem;
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  background: var(--surface-2);
}

.site-info__label {
  font-size: 0.75rem;
  color: var(--text-soft);
}

.site-info__value {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
</style>
