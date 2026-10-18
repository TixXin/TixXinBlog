<!--
  @file SiteNavigationFields.vue
  @description 站点设置“导航与页脚”编辑区：导航模块显隐与排序、外链导航、页脚链接、每日一言、备案号与版权文案；
  排序用按钮完成，键盘可操作，不依赖拖拽。数据通过 v-model 传入，保存与冲突沿用站点设置页。
-->
<template>
  <fieldset class="site-nav-fields" :disabled="disabled">
    <legend>导航与页脚</legend>
    <p :id="ids.hint">隐藏的模块只是不出现在导航中，页面地址仍可访问并被搜索引擎收录；首页始终显示。</p>
    <p class="site-nav-fields__live" role="status" aria-live="polite">{{ movement }}</p>

    <fieldset>
      <legend>导航（显隐与顺序）</legend>
      <p v-if="errors.navigation" :id="ids.navigation" role="alert">{{ errors.navigation }}</p>
      <ol class="site-nav-fields__list">
        <li
          v-for="(entry, index) in value.navigation"
          :key="itemKey(entry)"
          class="site-nav-fields__row"
          :data-row="`nav-${index}`"
        >
          <template v-if="entry.type === 'route'">
            <label class="site-nav-fields__toggle">
              <input
                v-model="entry.visible"
                type="checkbox"
                :disabled="entry.key === 'home'"
                :aria-describedby="entry.key === 'home' ? ids.hint : undefined"
              />
              <Icon :name="navRouteCatalog[entry.key].icon" aria-hidden="true" />
              显示「{{ navRouteCatalog[entry.key].label }}」<span class="site-nav-fields__path">{{
                navRouteCatalog[entry.key].to
              }}</span>
            </label>
          </template>
          <template v-else>
            <label
              >外链名称<input
                v-model="entry.label"
                :maxlength="SITE_EXTRA_LIMITS.navLabel"
                required
                :aria-invalid="!!errors[`nav-${index}-label`]"
                :aria-describedby="errors[`nav-${index}-label`] ? errorId(`nav-${index}-label`) : undefined"
            /></label>
            <p v-if="errors[`nav-${index}-label`]" :id="errorId(`nav-${index}-label`)" class="site-nav-fields__error">
              {{ errors[`nav-${index}-label`] }}
            </p>
            <label
              >外链地址<input
                v-model="entry.url"
                type="url"
                inputmode="url"
                :maxlength="SITE_EXTRA_LIMITS.url"
                placeholder="https://"
                required
                :aria-invalid="!!errors[`nav-${index}-url`]"
                :aria-describedby="errors[`nav-${index}-url`] ? errorId(`nav-${index}-url`) : undefined"
            /></label>
            <p v-if="errors[`nav-${index}-url`]" :id="errorId(`nav-${index}-url`)" class="site-nav-fields__error">
              {{ errors[`nav-${index}-url`] }}
            </p>
            <label class="site-nav-fields__toggle"><input v-model="entry.newTab" type="checkbox" />新窗口打开</label>
            <label class="site-nav-fields__toggle"><input v-model="entry.visible" type="checkbox" />显示此外链</label>
          </template>
          <div class="site-nav-fields__actions">
            <button
              type="button"
              data-move="up"
              :disabled="index === 0"
              :aria-label="`上移${navName(entry)}`"
              @click="move(value.navigation, index, -1, 'nav', navName(entry))"
            >
              上移
            </button>
            <button
              type="button"
              data-move="down"
              :disabled="index === value.navigation.length - 1"
              :aria-label="`下移${navName(entry)}`"
              @click="move(value.navigation, index, 1, 'nav', navName(entry))"
            >
              下移
            </button>
            <button
              v-if="entry.type === 'external'"
              type="button"
              :aria-label="`移除${navName(entry)}`"
              @click="remove(value.navigation, index, navName(entry))"
            >
              移除
            </button>
          </div>
        </li>
      </ol>
      <button
        type="button"
        :disabled="externalCount >= MAX_EXTERNAL_NAV"
        @click="value.navigation.push({ type: 'external', label: '', url: '', newTab: true, visible: true })"
      >
        添加外链导航（{{ externalCount }}/{{ MAX_EXTERNAL_NAV }}）
      </button>
    </fieldset>

    <fieldset>
      <legend>页脚链接（最多 {{ MAX_FOOTER_LINKS }} 个）</legend>
      <p v-if="errors.footerLinks" role="alert">{{ errors.footerLinks }}</p>
      <p v-if="!value.footerLinks.length">当前不展示页脚链接。</p>
      <ol class="site-nav-fields__list">
        <li
          v-for="(link, index) in value.footerLinks"
          :key="itemKey(link)"
          class="site-nav-fields__row"
          :data-row="`footer-${index}`"
        >
          <label
            >链接名称<input
              v-model="link.label"
              :maxlength="SITE_EXTRA_LIMITS.footerLabel"
              required
              :aria-invalid="!!errors[`footer-${index}-label`]"
              :aria-describedby="errors[`footer-${index}-label`] ? errorId(`footer-${index}-label`) : undefined"
          /></label>
          <p
            v-if="errors[`footer-${index}-label`]"
            :id="errorId(`footer-${index}-label`)"
            class="site-nav-fields__error"
          >
            {{ errors[`footer-${index}-label`] }}
          </p>
          <label
            >链接地址<input
              v-model="link.url"
              :maxlength="SITE_EXTRA_LIMITS.url"
              placeholder="/about 或 https://"
              required
              :aria-invalid="!!errors[`footer-${index}-url`]"
              :aria-describedby="
                [ids.footerHint, errors[`footer-${index}-url`] ? errorId(`footer-${index}-url`) : '']
                  .filter(Boolean)
                  .join(' ')
              "
          /></label>
          <p v-if="errors[`footer-${index}-url`]" :id="errorId(`footer-${index}-url`)" class="site-nav-fields__error">
            {{ errors[`footer-${index}-url`] }}
          </p>
          <label class="site-nav-fields__toggle"><input v-model="link.newTab" type="checkbox" />新窗口打开</label>
          <div class="site-nav-fields__actions">
            <button
              type="button"
              data-move="up"
              :disabled="index === 0"
              :aria-label="`上移页脚链接${link.label || index + 1}`"
              @click="move(value.footerLinks, index, -1, 'footer', `页脚链接${link.label || index + 1}`)"
            >
              上移
            </button>
            <button
              type="button"
              data-move="down"
              :disabled="index === value.footerLinks.length - 1"
              :aria-label="`下移页脚链接${link.label || index + 1}`"
              @click="move(value.footerLinks, index, 1, 'footer', `页脚链接${link.label || index + 1}`)"
            >
              下移
            </button>
            <button
              type="button"
              :aria-label="`移除页脚链接${link.label || index + 1}`"
              @click="remove(value.footerLinks, index, `页脚链接${link.label || index + 1}`)"
            >
              移除
            </button>
          </div>
        </li>
      </ol>
      <p :id="ids.footerHint">站内页面填写 / 开头的路径；RSS、站点地图等文件或站外地址按原生链接打开。</p>
      <button
        type="button"
        :disabled="value.footerLinks.length >= MAX_FOOTER_LINKS"
        @click="value.footerLinks.push({ label: '', url: '', newTab: false })"
      >
        添加页脚链接
      </button>
    </fieldset>

    <fieldset>
      <legend>每日一言（最多 {{ MAX_QUOTES }} 条）</legend>
      <p>每次打开页面随机展示一条；清空后不展示一言。</p>
      <p v-if="errors.quotes" role="alert">{{ errors.quotes }}</p>
      <ol class="site-nav-fields__list">
        <li
          v-for="(_quote, index) in value.quotes"
          :key="`${index}-${value.quotes.length}`"
          class="site-nav-fields__row"
          :data-row="`quote-${index}`"
        >
          <label
            >第 {{ index + 1 }} 条<input
              v-model="value.quotes[index]"
              :maxlength="MAX_QUOTE_LENGTH"
              required
              :aria-invalid="!!errors[`quote-${index}`]"
              :aria-describedby="errors[`quote-${index}`] ? errorId(`quote-${index}`) : undefined"
          /></label>
          <p v-if="errors[`quote-${index}`]" :id="errorId(`quote-${index}`)" class="site-nav-fields__error">
            {{ errors[`quote-${index}`] }}
          </p>
          <div class="site-nav-fields__actions">
            <button
              type="button"
              data-move="up"
              :disabled="index === 0"
              :aria-label="`上移第 ${index + 1} 条一言`"
              @click="move(value.quotes, index, -1, 'quote', '一言')"
            >
              上移
            </button>
            <button
              type="button"
              data-move="down"
              :disabled="index === value.quotes.length - 1"
              :aria-label="`下移第 ${index + 1} 条一言`"
              @click="move(value.quotes, index, 1, 'quote', '一言')"
            >
              下移
            </button>
            <button
              type="button"
              :aria-label="`移除第 ${index + 1} 条一言`"
              @click="remove(value.quotes, index, `第 ${index + 1} 条一言`)"
            >
              移除
            </button>
          </div>
        </li>
      </ol>
      <button type="button" :disabled="value.quotes.length >= MAX_QUOTES" @click="value.quotes.push('')">
        添加一言
      </button>
    </fieldset>

    <fieldset>
      <legend>备案与版权</legend>
      <label
        >ICP 备案号（选填）<input
          v-model="value.icpNumber"
          :maxlength="SITE_EXTRA_LIMITS.icpNumber"
          placeholder="如：京ICP备00000000号"
          :aria-invalid="!!errors.icpNumber"
          :aria-describedby="errors.icpNumber ? errorId('icpNumber') : undefined"
      /></label>
      <p v-if="errors.icpNumber" :id="errorId('icpNumber')" class="site-nav-fields__error">{{ errors.icpNumber }}</p>
      <label
        >备案链接（选填）<input
          v-model="value.icpUrl"
          type="url"
          inputmode="url"
          :maxlength="SITE_EXTRA_LIMITS.icpUrl"
          :placeholder="DEFAULT_ICP_URL"
          :aria-invalid="!!errors.icpUrl"
          :aria-describedby="[ids.icpHint, errors.icpUrl ? errorId('icpUrl') : ''].filter(Boolean).join(' ')"
      /></label>
      <p :id="ids.icpHint">留空时链接到工信部备案查询；未填写备案号时页脚不展示备案信息。</p>
      <p v-if="errors.icpUrl" :id="errorId('icpUrl')" class="site-nav-fields__error">{{ errors.icpUrl }}</p>
      <label
        >版权文案（选填）<input
          v-model="value.copyright"
          :maxlength="SITE_EXTRA_LIMITS.copyright"
          :placeholder="`© {year} ${value.name || '{siteName}'}. All rights reserved.`"
          :aria-invalid="!!errors.copyright"
          :aria-describedby="
            [ids.copyrightHint, errors.copyright ? errorId('copyright') : ''].filter(Boolean).join(' ')
          "
      /></label>
      <p :id="ids.copyrightHint">
        留空使用默认格式“{{ formatCopyright('', year, value.name) }}”；可用 {year} 表示当前年份、{siteName}
        表示站点名称。
      </p>
      <p v-if="errors.copyright" :id="errorId('copyright')" class="site-nav-fields__error">{{ errors.copyright }}</p>
      <p>
        页脚预览：{{ formatCopyright(value.copyright, year, value.name)
        }}<template v-if="value.icpNumber.trim()"> · {{ value.icpNumber.trim() }}</template>
      </p>
    </fieldset>
  </fieldset>
</template>

<script setup lang="ts">
import type { SiteSettingsData } from '~/features/site/settings'
import type { SiteNavEntry } from '~/features/nav/types'
import { MAX_EXTERNAL_NAV, navRouteCatalog } from '~/features/nav/routes'
import {
  DEFAULT_ICP_URL,
  MAX_FOOTER_LINKS,
  MAX_QUOTES,
  MAX_QUOTE_LENGTH,
  formatCopyright,
} from '~/features/site/footer'
import { SITE_EXTRA_LIMITS, siteExtrasErrors } from '~/features/site/extras'

const value = defineModel<SiteSettingsData>({ required: true })
defineProps<{ disabled?: boolean }>()

const uid = useId()
const ids = {
  hint: `${uid}-hint`,
  navigation: `${uid}-navigation`,
  footerHint: `${uid}-footer-hint`,
  icpHint: `${uid}-icp-hint`,
  copyrightHint: `${uid}-copyright-hint`,
}
const errorId = (field: string) => `${uid}-${field}-error`
const year = new Date().getFullYear()
const movement = ref('')
const errors = computed(() => siteExtrasErrors(value.value))
const externalCount = computed(() => value.value.navigation.filter((entry) => entry.type === 'external').length)

const keys = new WeakMap<object, number>()
let nextKey = 0
function itemKey(item: object) {
  const raw = toRaw(item)
  if (!keys.has(raw)) keys.set(raw, ++nextKey)
  return keys.get(raw)!
}
function navName(entry: SiteNavEntry) {
  return entry.type === 'route' ? `导航「${navRouteCatalog[entry.key].label}」` : `外链导航${entry.label || ''}`
}
/** 移动后把焦点放回同方向的按钮（到达边界时换到另一方向），并播报新位置 */
async function move<T>(items: T[], index: number, direction: number, group: string, name: string) {
  const target = index + direction
  if (target < 0 || target >= items.length) return
  const item = items.splice(index, 1)[0]!
  items.splice(target, 0, item)
  movement.value = `${name}已移至第 ${target + 1} 项`
  await nextTick()
  const row = document.querySelector<HTMLElement>(`[data-row="${group}-${target}"]`)
  const same = row?.querySelector<HTMLButtonElement>(`[data-move="${direction < 0 ? 'up' : 'down'}"]`)
  const other = row?.querySelector<HTMLButtonElement>(`[data-move="${direction < 0 ? 'down' : 'up'}"]`)
  ;(same && !same.disabled ? same : other)?.focus()
}
function remove<T>(items: T[], index: number, name: string) {
  items.splice(index, 1)
  movement.value = `已移除${name}`
}
</script>

<style scoped lang="scss">
.site-nav-fields__list {
  display: grid;
  gap: 0.5rem;
  padding: 0;
  margin: 0;
  list-style: none;
}

.site-nav-fields__row {
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--border);
}

.site-nav-fields__toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.site-nav-fields__path {
  color: var(--text-muted);
  font-size: 0.85em;
}

.site-nav-fields__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.site-nav-fields__error {
  color: var(--danger-text);
}

.site-nav-fields__live {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>
