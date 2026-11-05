<!-- @file AboutSupportFields.vue @description 支持方式表单：开关、感谢语与最多六种方式（链接或收款码图片），关闭时公开页不展示任何占位 -->
<template>
  <fieldset class="about-support">
    <legend>{{ t('admin-system.siteAbout.support.legend') }}</legend>
    <p>{{ t('admin-system.siteAbout.support.hint') }}</p>
    <label class="about-support__toggle"
      ><input v-model="support.visible" type="checkbox" />{{ t('admin-system.siteAbout.support.visible') }}</label
    >
    <label>{{ t('admin-system.siteAbout.support.message') }}<input v-model="support.message" maxlength="300" /></label>
    <label
      >{{ t('admin-system.siteAbout.support.messageEn') }}<input v-model="messageEn" maxlength="300" lang="en"
    /></label>
    <fieldset v-for="(method, index) in support.methods" :key="index">
      <legend>{{ t('admin-system.siteAbout.support.methodLegend', { index: index + 1 }) }}</legend>
      <label
        >{{ t('admin-system.siteAbout.support.methodLabel') }}<input v-model="method.label" maxlength="40"
      /></label>
      <label
        >{{ t('admin-system.siteAbout.support.methodUrl')
        }}<input v-model.trim="method.url" type="url" inputmode="url" maxlength="500" placeholder="https://"
      /></label>
      <label
        >{{ t('admin-system.siteAbout.support.methodImage')
        }}<input v-model.trim="method.image" inputmode="url" maxlength="1000" placeholder="/api/v1/media/…"
      /></label>
      <button
        type="button"
        :aria-label="t('admin-system.siteAbout.support.removeLabel', { name: method.label || index + 1 })"
        @click="support.methods.splice(index, 1)"
      >
        {{ t('admin-system.siteAbout.support.remove') }}
      </button>
    </fieldset>
    <button
      type="button"
      :disabled="support.methods.length >= 6"
      @click="support.methods.push({ label: '', url: '', image: '' })"
    >
      {{ t('admin-system.siteAbout.support.add') }}
    </button>
  </fieldset>
</template>
<script setup lang="ts">
import type { AboutSupport } from '~/features/about/types'
const { t } = useI18n()
const support = defineModel<AboutSupport>({ required: true })
/** 英文感谢语为空时不写入字段 */
const messageEn = computed({
  get: () => support.value.messageEn ?? '',
  set: (value: string) => {
    if (value) support.value.messageEn = value
    else delete support.value.messageEn
  },
})
</script>
<style scoped lang="scss">
fieldset {
  min-width: 0;
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  padding: 1rem;
  margin-block: 1rem;
}
legend {
  padding-inline: 0.5rem;
}
p {
  margin-block: 0.75rem;
  color: var(--text-muted);
}
label {
  display: grid;
  gap: 0.5rem;
  margin-block: 0.75rem;
}
.about-support__toggle {
  display: flex;
  align-items: center;
}
</style>
