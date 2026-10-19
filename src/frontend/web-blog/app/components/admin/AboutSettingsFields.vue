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
    <fieldset v-for="(section, sectionIndex) in value.sections" :key="section.kind">
      <legend>{{ sectionName(section.kind) }}</legend>
      <label class="about-fields__toggle"
        ><input v-model="section.visible" type="checkbox" />{{ t('admin-system.siteAbout.sectionVisible') }}</label
      >
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
        <label>{{ t('admin-system.siteAbout.itemTitle') }}<input v-model="item.title" maxlength="120" /></label>
        <label>{{ t('admin-system.siteAbout.itemPeriod') }}<input v-model="item.period" maxlength="80" /></label>
        <label
          >{{ t('admin-system.siteAbout.itemDetail') }}<textarea v-model="item.detail" maxlength="1000" rows="3" />
        </label>
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
    <section :aria-label="t('admin-system.siteAbout.previewLabel')">
      <h2>{{ t('admin-system.siteAbout.previewTitle') }}</h2>
      <p v-if="!value.visible">{{ t('admin-system.siteAbout.notPublic') }}</p>
      <AboutProfileContent :value="value" />
    </section>
  </fieldset>
</template>
<script setup lang="ts">
import type { AboutSettings, AboutSection } from '~/features/about/types'
import { aboutSectionLabel, aboutSectionLabelKeys } from '~/features/about/settings'
const { t } = useI18n()
const value = defineModel<AboutSettings>({ required: true })
const sectionName = (kind: AboutSection['kind']) => aboutSectionLabel(kind, t)
const itemName = (title: string, index: number) =>
  title || t('admin-system.siteAbout.itemFallback', { index: index + 1 })
defineProps<{ disabled?: boolean }>()
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
input,
textarea,
button {
  min-width: 0;
  max-width: 100%;
  background: var(--surface-2);
  color: var(--text-main);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  padding: 0.65rem;
}
.about-fields__toggle {
  display: flex;
  align-items: center;
}
.about-fields__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-block: 0.75rem;
}
button:disabled {
  opacity: 0.5;
}
</style>
