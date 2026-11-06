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
      <!-- 收款码优先从媒体库选择：受管媒体随站点资料登记引用，不会被当作未使用资源回收 -->
      <div class="about-support__image">
        <img
          v-if="method.image"
          :src="method.image"
          :alt="t('admin-system.siteAbout.support.imagePreview', { name: method.label || index + 1 })"
          class="about-support__thumb"
          width="96"
          height="96"
        />
        <div class="about-support__actions">
          <button
            type="button"
            :aria-label="t('admin-system.siteAbout.support.pickImageLabel', { name: method.label || index + 1 })"
            @click="pick(index)"
          >
            {{ t('admin-system.siteAbout.support.pickImage') }}
          </button>
          <button
            v-if="method.image"
            type="button"
            :aria-label="t('admin-system.siteAbout.support.clearImageLabel', { name: method.label || index + 1 })"
            @click="method.image = ''"
          >
            {{ t('admin-system.siteAbout.support.clearImage') }}
          </button>
        </div>
      </div>
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
    <ClientOnly><AdminMediaPicker v-model:open="pickerOpen" @selected="select" /></ClientOnly>
  </fieldset>
</template>
<script setup lang="ts">
import type { AboutSupport } from '~/features/about/types'
import type { MediaAsset } from '~/features/media/types'
const { t } = useI18n()
const support = defineModel<AboutSupport>({ required: true })
const pickerOpen = ref(false)
/** 正在选择图片的方式序号；选择器只有一个，按打开时的序号回填 */
const target = ref(-1)
function pick(index: number) {
  target.value = index
  pickerOpen.value = true
}
function select(asset: MediaAsset) {
  const method = support.value.methods[target.value]
  if (method) method.image = asset.url
  target.value = -1
}
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
.about-support__image {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  margin-block: 0.75rem;
}
.about-support__thumb {
  width: 6rem;
  height: 6rem;
  object-fit: contain;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  background: #fff;
}
.about-support__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
</style>
