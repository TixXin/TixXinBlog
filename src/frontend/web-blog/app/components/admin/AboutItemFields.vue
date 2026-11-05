<!-- @file AboutItemFields.vue @description 关于页单个条目的输入：名称、随栏目含义变化的补充字段、说明、链接与可折叠的英文版本 -->
<template>
  <label>{{ t('admin-system.siteAbout.itemTitle') }}<input v-model="item.title" maxlength="120" /></label>
  <label>{{ t(`admin-system.siteAbout.periodLabel.${kind}`) }}<input v-model="item.period" maxlength="80" /></label>
  <label
    >{{ t('admin-system.siteAbout.itemDetail') }}<textarea v-model="item.detail" maxlength="1000" rows="3" />
  </label>
  <label
    >{{ t('admin-system.siteAbout.itemUrl')
    }}<input v-model.trim="url" type="url" inputmode="url" maxlength="500" placeholder="https://"
  /></label>
  <details class="about-item-fields__en" :open="hasEnglish">
    <summary>{{ t('admin-system.siteAbout.englishLegend') }}</summary>
    <label>{{ t('admin-system.siteAbout.itemTitleEn') }}<input v-model="enTitle" maxlength="120" lang="en" /></label>
    <label>{{ t('admin-system.siteAbout.itemPeriodEn') }}<input v-model="enPeriod" maxlength="80" lang="en" /></label>
    <label
      >{{ t('admin-system.siteAbout.itemDetailEn') }}<textarea v-model="enDetail" maxlength="1000" rows="2" lang="en" />
    </label>
  </details>
</template>
<script setup lang="ts">
import type { AboutItem, AboutSectionKind } from '~/features/about/types'
const { t } = useI18n()
const item = defineModel<AboutItem>({ required: true })
defineProps<{ kind: AboutSectionKind }>()
const blank = () => ({ title: '', detail: '', period: '' })
/** 空链接不写入字段，保存的数据与未用过链接的旧条目一致 */
const url = computed({
  get: () => item.value.url ?? '',
  set: (value: string) => {
    if (value) item.value.url = value
    else delete item.value.url
  },
})
/** 英文字段全部为空时删除 en，避免保存一组空翻译 */
function englishField(key: 'title' | 'detail' | 'period') {
  return computed({
    get: () => item.value.en?.[key] ?? '',
    set: (value: string) => {
      const next = { ...blank(), ...item.value.en, [key]: value }
      if (next.title || next.detail || next.period) item.value.en = next
      else delete item.value.en
    },
  })
}
const enTitle = englishField('title')
const enPeriod = englishField('period')
const enDetail = englishField('detail')
const hasEnglish = computed(() => !!item.value.en)
</script>
<style scoped lang="scss">
label {
  display: grid;
  gap: 0.5rem;
  margin-block: 0.75rem;
}
.about-item-fields__en {
  margin-block: 0.75rem;
  summary {
    cursor: pointer;
    color: var(--text-muted);
  }
}
</style>
