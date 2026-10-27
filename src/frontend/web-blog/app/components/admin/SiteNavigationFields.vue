<!--
  @file SiteNavigationFields.vue
  @description 站点设置“导航与页脚”编辑区：导航模块显隐与排序、外链导航、页脚链接、每日一言、备案号与版权文案；
  排序用按钮完成，键盘可操作，不依赖拖拽。数据通过 v-model 传入，保存与冲突沿用站点设置页。
-->
<template>
  <fieldset class="site-nav-fields" :disabled="disabled">
    <legend>{{ t('admin-system.siteNav.legend') }}</legend>
    <p :id="ids.hint">{{ t('admin-system.siteNav.hint') }}</p>
    <p class="site-nav-fields__live" role="status" aria-live="polite">{{ movement }}</p>

    <AdminSiteNavNavigationList v-model="value" :uid="uid" :errors="errors" @announce="movement = $event" />
    <AdminSiteNavFooterLinks v-model="value" :uid="uid" :errors="errors" @announce="movement = $event" />
    <AdminSiteNavQuotes v-model="value" :uid="uid" :errors="errors" @announce="movement = $event" />
    <AdminSiteNavFooterInfo v-model="value" :uid="uid" :errors="errors" />
  </fieldset>
</template>

<script setup lang="ts">
import type { SiteSettingsData } from '~/features/site/settings'
import { siteExtrasErrors } from '~/features/site/extras'

const { t } = useI18n()
const value = defineModel<SiteSettingsData>({ required: true })
defineProps<{ disabled?: boolean }>()

const uid = useId()
const ids = { hint: `${uid}-hint` }
const movement = ref('')
const errors = computed(() => siteExtrasErrors(value.value, t))
</script>

<style scoped lang="scss">
@use '~/assets/styles/site-nav-fields' as nav;

@include nav.fields;
</style>
