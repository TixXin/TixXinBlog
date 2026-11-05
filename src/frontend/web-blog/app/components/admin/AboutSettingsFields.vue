<!-- @file AboutSettingsFields.vue @description 关于页资料表单，复用站点编辑保护，条目排序及显隐由用户维护 -->
<template>
  <fieldset class="about-fields" :disabled="disabled">
    <legend>{{ t('admin-system.siteAbout.legend') }}</legend>
    <p role="status" aria-live="polite">{{ movement }}</p>
    <p>{{ t('admin-system.siteAbout.hint') }}</p>
    <label class="about-fields__toggle"
      ><input v-model="value.visible" type="checkbox" />{{ t('admin-system.siteAbout.visible') }}</label
    >
    <label
      >{{ t('admin-system.siteAbout.introduction') }}<textarea v-model="value.introduction" maxlength="5000" rows="6" />
    </label>
    <p>{{ t('admin-system.siteAbout.introductionHint') }}</p>
    <details :open="!!value.en">
      <summary>{{ t('admin-system.siteAbout.englishLegend') }}</summary>
      <p>{{ t('admin-system.siteAbout.englishHint') }}</p>
      <label
        >{{ t('admin-system.siteAbout.introductionEn')
        }}<textarea v-model="introductionEn" maxlength="5000" rows="4" lang="en" />
      </label>
    </details>
    <label class="about-fields__toggle"
      ><input v-model="showSiteInfo" type="checkbox" />{{ t('admin-system.siteAbout.showSiteInfo') }}</label
    >
    <fieldset v-for="(section, sectionIndex) in value.sections" :key="section.kind">
      <legend>{{ sectionName(section.kind) }}</legend>
      <label class="about-fields__toggle"
        ><input v-model="section.visible" type="checkbox" />{{ t('admin-system.siteAbout.sectionVisible') }}</label
      >
      <div v-if="section.kind === 'now'" class="about-fields__actions">
        <label class="about-fields__inline"
          >{{ t('admin-system.siteAbout.updatedAt') }}<input v-model="section.updatedAt" type="date"
        /></label>
        <button type="button" @click="section.updatedAt = today()">
          {{ t('admin-system.siteAbout.updatedToday') }}
        </button>
      </div>
      <div class="about-fields__actions">
        <button
          type="button"
          :disabled="sectionIndex === 0"
          :aria-label="t('admin-system.siteAbout.moveSectionUpLabel', { section: sectionName(section.kind) })"
          @click="move(value.sections, sectionIndex, -1, $event)"
        >
          {{ t('admin-system.siteAbout.moveSectionUp') }}
        </button>
        <button
          type="button"
          :disabled="sectionIndex === value.sections.length - 1"
          :aria-label="t('admin-system.siteAbout.moveSectionDownLabel', { section: sectionName(section.kind) })"
          @click="move(value.sections, sectionIndex, 1, $event)"
        >
          {{ t('admin-system.siteAbout.moveSectionDown') }}
        </button>
      </div>
      <fieldset v-for="(item, index) in section.items" :key="itemKey(item)">
        <legend>
          {{ t('admin-system.siteAbout.itemLegend', { section: sectionName(section.kind), index: index + 1 }) }}
        </legend>
        <AdminAboutItemFields v-model="section.items[index]!" :kind="section.kind" />
        <label class="about-fields__toggle"
          ><input v-model="item.visible" type="checkbox" />{{ t('admin-system.siteAbout.itemVisible') }}</label
        >
        <div class="about-fields__actions">
          <button
            type="button"
            :disabled="index === 0"
            :aria-label="t('admin-system.siteAbout.moveUpLabel', { name: itemName(item.title, index) })"
            @click="move(section.items, index, -1, $event)"
          >
            {{ t('admin-system.siteAbout.moveUp') }}
          </button>
          <button
            type="button"
            :disabled="index === section.items.length - 1"
            :aria-label="t('admin-system.siteAbout.moveDownLabel', { name: itemName(item.title, index) })"
            @click="move(section.items, index, 1, $event)"
          >
            {{ t('admin-system.siteAbout.moveDown') }}
          </button>
          <button
            type="button"
            :aria-label="t('admin-system.siteAbout.removeLabel', { name: itemName(item.title, index) })"
            @click="remove(section.items, index, $event)"
          >
            {{ t('admin-system.siteAbout.removeItem') }}
          </button>
        </div>
      </fieldset>
      <button
        type="button"
        :disabled="section.items.length >= 30"
        @click="section.items.push({ title: '', detail: '', period: '', visible: false })"
      >
        {{ t('admin-system.siteAbout.addItem', { section: sectionName(section.kind) }) }}
      </button>
    </fieldset>
    <div class="about-fields__actions">
      <button
        v-for="kind in remaining"
        :key="kind"
        type="button"
        @click="value.sections.push({ kind, visible: false, items: [] })"
      >
        {{ t('admin-system.siteAbout.addSection', { section: sectionName(kind) }) }}
      </button>
    </div>
    <AdminAboutSupportFields v-if="value.support" v-model="value.support" />
    <button v-else type="button" @click="value.support = { ...emptySupport(), visible: true }">
      {{ t('admin-system.siteAbout.support.setup') }}
    </button>
    <section :aria-label="t('admin-system.siteAbout.previewLabel')">
      <h2>{{ t('admin-system.siteAbout.previewTitle') }}</h2>
      <p v-if="!value.visible">{{ t('admin-system.siteAbout.notPublic') }}</p>
      <AboutProfileContent :value="value" />
    </section>
  </fieldset>
</template>
<script setup lang="ts">
import type { AboutSettings, AboutSection } from '~/features/about/types'
import { aboutSectionLabel, aboutSectionLabelKeys, emptySupport } from '~/features/about/settings'
const { t } = useI18n()
const value = defineModel<AboutSettings>({ required: true })
const sectionName = (kind: AboutSection['kind']) => aboutSectionLabel(kind, t)
const itemName = (title: string, index: number) =>
  title || t('admin-system.siteAbout.itemFallback', { index: index + 1 })
defineProps<{ disabled?: boolean }>()
/** 英文简介为空时删除 en；开关为关时删除键，保存的数据与未用过新功能的旧资料一致 */
const introductionEn = computed({
  get: () => value.value.en?.introduction ?? '',
  set: (introduction: string) => {
    if (introduction) value.value.en = { introduction }
    else delete value.value.en
  },
})
const showSiteInfo = computed({
  get: () => value.value.showSiteInfo === true,
  set: (on: boolean) => {
    if (on) value.value.showSiteInfo = true
    else delete value.value.showSiteInfo
  },
})
/** 本地日期 YYYY-MM-DD，作为“现在”栏目的更新日期 */
function today() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
const movement = ref('')
const keys = new WeakMap<object, number>()
let nextKey = 0
function itemKey(item: object) {
  const raw = toRaw(item)
  if (!keys.has(raw)) keys.set(raw, ++nextKey)
  return keys.get(raw)!
}
const remaining = computed(() =>
  (Object.keys(aboutSectionLabelKeys) as AboutSection['kind'][]).filter(
    (kind) => !value.value.sections.some((section) => section.kind === kind),
  ),
)
async function move<T>(items: T[], index: number, direction: number, event: Event) {
  const target = index + direction
  if (target < 0 || target >= items.length) return
  const group = (event.currentTarget as HTMLElement).closest('fieldset')
  const item = items.splice(index, 1)[0]!
  items.splice(target, 0, item)
  await nextTick()
  group?.querySelector<HTMLInputElement>('input')?.focus()
  movement.value = t('admin-system.siteAbout.moved', { position: target + 1 })
}
async function remove<T>(items: T[], index: number, event: Event) {
  const group = (event.currentTarget as HTMLElement).closest('fieldset')?.parentElement
  items.splice(index, 1)
  await nextTick()
  const rows = group?.querySelectorAll(':scope > fieldset')
  const next = rows?.[Math.min(index, items.length - 1)]
  if (next) next.querySelector<HTMLInputElement>('input')?.focus()
  else group?.querySelector<HTMLButtonElement>(':scope > button')?.focus()
  movement.value = t('admin-system.siteAbout.removed')
}
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

.about-fields__toggle {
  display: flex;
  align-items: center;
}
.about-fields__inline {
  display: flex;
  align-items: center;
  margin-block: 0;
}
details {
  margin-block: 0.75rem;
  summary {
    cursor: pointer;
    color: var(--text-muted);
  }
}
.about-fields__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-block: 0.75rem;
}
</style>
