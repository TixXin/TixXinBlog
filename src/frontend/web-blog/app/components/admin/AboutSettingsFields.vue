<!-- @file AboutSettingsFields.vue @description 关于页资料表单，复用站点编辑保护，条目排序及显隐由用户维护 -->
<template>
  <fieldset class="about-fields" :disabled="disabled">
    <legend>关于页资料</legend>
    <p role="status" aria-live="polite">{{ movement }}</p>
    <p>姓名、简介、头像与联系方式复用上方站点资料。仅填写你确认可公开的内容；空栏目不展示。</p>
    <label class="about-fields__toggle"><input v-model="value.visible" type="checkbox" />公开以下关于页资料</label>
    <label>详细介绍<textarea v-model="value.introduction" maxlength="5000" rows="6" /></label>
    <fieldset v-for="(section, sectionIndex) in value.sections" :key="section.kind">
      <legend>{{ aboutSectionLabels[section.kind] }}</legend>
      <label class="about-fields__toggle"><input v-model="section.visible" type="checkbox" />公开此栏目</label>
      <div class="about-fields__actions">
        <button
          type="button"
          :disabled="sectionIndex === 0"
          :aria-label="`上移${aboutSectionLabels[section.kind]}栏目`"
          @click="move(value.sections, sectionIndex, -1, $event)"
        >
          上移栏目
        </button>
        <button
          type="button"
          :disabled="sectionIndex === value.sections.length - 1"
          :aria-label="`下移${aboutSectionLabels[section.kind]}栏目`"
          @click="move(value.sections, sectionIndex, 1, $event)"
        >
          下移栏目
        </button>
      </div>
      <fieldset v-for="(item, index) in section.items" :key="itemKey(item)">
        <legend>{{ aboutSectionLabels[section.kind] }}条目 {{ index + 1 }}</legend>
        <label>名称<input v-model="item.title" maxlength="120" /></label>
        <label>时间或阶段（选填）<input v-model="item.period" maxlength="80" /></label>
        <label>说明（选填）<textarea v-model="item.detail" maxlength="1000" rows="3" /></label>
        <label class="about-fields__toggle"><input v-model="item.visible" type="checkbox" />公开此条目</label>
        <div class="about-fields__actions">
          <button
            type="button"
            :disabled="index === 0"
            :aria-label="`上移${item.title || '条目 ' + (index + 1)}`"
            @click="move(section.items, index, -1, $event)"
          >
            上移
          </button>
          <button
            type="button"
            :disabled="index === section.items.length - 1"
            :aria-label="`下移${item.title || '条目 ' + (index + 1)}`"
            @click="move(section.items, index, 1, $event)"
          >
            下移
          </button>
          <button
            type="button"
            :aria-label="`移除${item.title || '条目 ' + (index + 1)}`"
            @click="remove(section.items, index, $event)"
          >
            移除条目
          </button>
        </div>
      </fieldset>
      <button
        type="button"
        :disabled="section.items.length >= 30"
        @click="section.items.push({ title: '', detail: '', period: '', visible: false })"
      >
        添加{{ aboutSectionLabels[section.kind] }}
      </button>
    </fieldset>
    <div class="about-fields__actions">
      <button
        v-for="kind in remaining"
        :key="kind"
        type="button"
        @click="value.sections.push({ kind, visible: false, items: [] })"
      >
        添加{{ aboutSectionLabels[kind] }}栏目
      </button>
    </div>
    <section aria-label="关于页公开内容预览">
      <h2>关于页预览</h2>
      <p v-if="!value.visible">以下资料尚未公开。</p>
      <AboutProfileContent :value="value" />
    </section>
  </fieldset>
</template>
<script setup lang="ts">
import type { AboutSettings, AboutSection } from '~/features/about/types'
import { aboutSectionLabels } from '~/features/about/settings'
const value = defineModel<AboutSettings>({ required: true })
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
  (Object.keys(aboutSectionLabels) as AboutSection['kind'][]).filter(
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
  movement.value = `已移至第 ${target + 1} 项`
}
async function remove<T>(items: T[], index: number, event: Event) {
  const group = (event.currentTarget as HTMLElement).closest('fieldset')?.parentElement
  items.splice(index, 1)
  await nextTick()
  const rows = group?.querySelectorAll(':scope > fieldset')
  const next = rows?.[Math.min(index, items.length - 1)]
  if (next) next.querySelector<HTMLInputElement>('input')?.focus()
  else group?.querySelector<HTMLButtonElement>(':scope > button')?.focus()
  movement.value = '条目已移除'
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
