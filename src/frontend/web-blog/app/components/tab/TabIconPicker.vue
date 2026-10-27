<!--
  @file TabIconPicker.vue
  @description 图标选择器三合一：Lucide 图标 / Emoji / 上传本地图片（dataURL）
  @author TixXin
  @since 2026-04-12
-->

<!--
  @file TabIconPicker.vue
  @description 图标选择器三合一：Lucide 图标 / Emoji / 上传本地图片（dataURL）
  @author TixXin
  @since 2026-04-12
-->

<template>
  <div class="icon-picker">
    <!-- Tab 切换 -->
    <div class="icon-picker__tabs" role="tablist">
      <button
        v-for="tab in tabs"
        :key="tab.value"
        type="button"
        role="tab"
        :aria-selected="activeTab === tab.value"
        class="icon-picker__tab"
        :class="{ 'icon-picker__tab--active': activeTab === tab.value }"
        @click="activeTab = tab.value"
      >
        <Icon :name="tab.icon" size="12" />
        <span>{{ tab.label }}</span>
      </button>
    </div>

    <!-- Lucide -->
    <div v-if="activeTab === 'lucide'" class="icon-picker__pane">
      <div class="icon-picker__search">
        <Icon name="lucide:search" size="12" class="icon-picker__search-icon" />
        <input
          v-model="searchQuery"
          type="text"
          class="icon-picker__search-input"
          :placeholder="$t('misc.tab.iconPicker.searchIcons')"
        />
      </div>
      <div class="icon-picker__grid">
        <button
          v-for="icon in filteredIcons"
          :key="icon.name"
          type="button"
          class="icon-picker__item"
          :class="{ 'icon-picker__item--active': modelValue === icon.name }"
          :title="icon.label"
          @click="$emit('update:modelValue', icon.name)"
        >
          <Icon :name="icon.name" size="16" />
        </button>
      </div>
      <div v-if="filteredIcons.length === 0" class="icon-picker__empty">{{ $t('misc.tab.iconPicker.noIcons') }}</div>
    </div>

    <!-- Emoji -->
    <div v-else-if="activeTab === 'emoji'" class="icon-picker__pane">
      <div class="icon-picker__search">
        <Icon name="lucide:search" size="12" class="icon-picker__search-icon" />
        <input
          v-model="emojiQuery"
          type="text"
          class="icon-picker__search-input"
          :placeholder="$t('misc.tab.iconPicker.searchEmoji')"
        />
      </div>
      <div class="icon-picker__grid icon-picker__grid--emoji">
        <button
          v-for="e in filteredEmojis"
          :key="e.char + e.keywords"
          type="button"
          class="icon-picker__item icon-picker__item--emoji"
          :class="{ 'icon-picker__item--active': modelValue === e.char }"
          :title="e.keywords"
          @click="$emit('update:modelValue', e.char)"
        >
          {{ e.char }}
        </button>
      </div>
      <div v-if="filteredEmojis.length === 0" class="icon-picker__empty">{{ $t('misc.tab.iconPicker.noEmoji') }}</div>
    </div>

    <!-- 上传 -->
    <TabIconPickerUpload
      v-else-if="activeTab === 'upload'"
      :model-value="modelValue"
      :upload-error="uploadError"
      @upload="onUpload"
      @clear="$emit('update:modelValue', '')"
    />
  </div>
</template>

<script setup lang="ts">
import TabIconPickerUpload from './TabIconPickerUpload.vue'
import { TAB_ICON_LIST, filterTabEmojis, filterTabIcons } from '~/features/tab/iconPickerCatalog'

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const { t } = useI18n()

type TabKey = 'lucide' | 'emoji' | 'upload'

const tabs = computed<{ value: TabKey; label: string; icon: string }[]>(() => [
  { value: 'lucide', label: 'Lucide', icon: 'lucide:shapes' },
  { value: 'emoji', label: 'Emoji', icon: 'lucide:smile' },
  { value: 'upload', label: t('misc.tab.iconPicker.upload'), icon: 'lucide:upload' },
])

const activeTab = ref<TabKey>(
  props.modelValue.startsWith('data:') ? 'upload' : props.modelValue.startsWith('lucide:') ? 'lucide' : 'emoji',
)

const searchQuery = ref('')
const emojiQuery = ref('')
const uploadError = ref('')

/** 名称按当前语言翻译；keywords 是中英混合的搜索别名，两种语言下都可检索 */
const localizedIcons = computed(() => TAB_ICON_LIST.map((icon) => ({ ...icon, label: t(icon.labelKey) })))
const filteredIcons = computed(() => filterTabIcons(localizedIcons.value, searchQuery.value))
const filteredEmojis = computed(() => filterTabEmojis(emojiQuery.value))

function onUpload(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  uploadError.value = ''
  if (file.size > 32 * 1024) {
    uploadError.value = t('misc.tab.iconPicker.tooLarge', { size: Math.round(file.size / 1024) })
    input.value = ''
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    if (typeof reader.result !== 'string') return
    emit('update:modelValue', reader.result)
  }
  reader.onerror = () => {
    uploadError.value = t('misc.tab.iconPicker.readFailed')
  }
  reader.readAsDataURL(file)
  input.value = ''
}
</script>

<style lang="scss" scoped>
@use '~/assets/styles/tab-icon-picker' as picker;

@include picker.picker;
</style>
