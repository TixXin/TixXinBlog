<!--
  @file SiteSettingsPreview.vue
  @description 站点与关于资料只读核对，管理员可比较隐藏字段，所有内容从 props 传入。
-->
<template>
  <section class="site-preview" :aria-label="label">
    <h2>{{ label }}</h2>
    <h3>{{ value.name }}</h3>
    <p>{{ value.description }}</p>
    <img
      v-if="value.avatar && !imageFailed"
      :key="value.avatar + imageAttempt"
      :src="value.avatar"
      :alt="value.avatarAlt"
      width="72"
      height="72"
      @error="imageFailed = true"
    />
    <p v-if="imageFailed" role="status">
      {{ t('admin-system.sitePreview.avatarFailed') }}
      <button type="button" @click="retryAvatar">{{ t('admin-system.sitePreview.retryAvatar') }}</button>
    </p>
    <p>{{ value.ownerName }} · {{ value.ownerTitle }}</p>
    <p>
      {{ t('admin-system.sitePreview.avatarAlt', { text: value.avatarAlt || t('admin-system.sitePreview.empty') }) }}
    </p>
    <ul>
      <li v-for="(social, index) in value.socials" :key="index">
        <Icon :name="social.icon" /> {{ social.label }} · {{ social.href }}
      </li>
    </ul>
    <p>
      {{
        t('admin-system.sitePreview.announcement', {
          text: value.announcement || t('admin-system.sitePreview.noAnnouncement'),
        })
      }}
    </p>
    <p>
      {{
        t('admin-system.sitePreview.seoTitle', {
          text: value.seoTitle && value.seoTitle !== value.name ? `${value.seoTitle} - ${value.name}` : value.name,
        })
      }}
    </p>
    <p>{{ t('admin-system.sitePreview.seoDescription', { text: value.seoDescription || value.description }) }}</p>
    <details v-if="value.about" class="site-preview__about">
      <summary>
        {{
          t('admin-system.sitePreview.aboutSummary', {
            state: value.about.visible
              ? t('admin-system.sitePreview.aboutPublic')
              : t('admin-system.sitePreview.aboutHidden'),
          })
        }}
      </summary>
      <p>{{ t('admin-system.sitePreview.aboutHint') }}</p>
      <p>
        {{
          t('admin-system.sitePreview.introduction', {
            text: value.about.introduction || t('admin-system.sitePreview.empty'),
          })
        }}
      </p>
      <p v-if="!value.about.sections.length">{{ t('admin-system.sitePreview.noSections') }}</p>
      <section v-for="section in value.about.sections" :key="section.kind">
        <h4>
          {{ aboutSectionLabel(section.kind, t) }} ·
          {{
            section.visible ? t('admin-system.sitePreview.sectionPublic') : t('admin-system.sitePreview.sectionHidden')
          }}
        </h4>
        <p v-if="!section.items.length">{{ t('admin-system.sitePreview.noItems') }}</p>
        <ol v-else>
          <li v-for="(item, index) in section.items" :key="index">
            <strong>{{ item.title || t('admin-system.sitePreview.untitled') }}</strong> ·
            {{ item.visible ? t('admin-system.sitePreview.itemPublic') : t('admin-system.sitePreview.itemHidden') }}
            <p v-if="item.period">{{ t('admin-system.sitePreview.period', { text: item.period }) }}</p>
            <p>
              {{ t('admin-system.sitePreview.detail', { text: item.detail || t('admin-system.sitePreview.empty') }) }}
            </p>
          </li>
        </ol>
      </section>
    </details>
    <div
      v-if="value.navigation"
      class="site-preview__extras"
      role="group"
      :aria-label="t('admin-system.sitePreview.extras')"
    >
      <p>
        <strong>{{ t('admin-system.sitePreview.extras') }}</strong>
      </p>
      <p>
        {{
          t('admin-system.sitePreview.navigation', { text: navigationText || t('admin-system.sitePreview.defaultNav') })
        }}
      </p>
      <p>
        {{
          t('admin-system.sitePreview.footerLinks', {
            text:
              (value.footerLinks ?? [])
                .map((link) => t('admin-system.sitePreview.footerLink', { label: link.label, url: link.url }))
                .join(' · ') || t('admin-system.sitePreview.notShown'),
          })
        }}
      </p>
      <p>
        {{
          t('admin-system.sitePreview.quotes', {
            text: value.quotes?.length
              ? t('admin-system.sitePreview.quoteCount', { count: value.quotes.length }, value.quotes.length)
              : t('admin-system.sitePreview.notShown'),
          })
        }}
      </p>
      <p>{{ t('admin-system.sitePreview.copyright', { text: formatCopyright(value.copyright, year, value.name) }) }}</p>
      <p>
        {{
          t('admin-system.sitePreview.icpNumber', { text: value.icpNumber || t('admin-system.sitePreview.notShown') })
        }}
      </p>
    </div>
  </section>
</template>
<script setup lang="ts">
import type { SiteSettingsData } from '~/features/site/settings'
import { navRouteCatalog } from '~/features/nav/routes'
import { formatCopyright } from '~/features/site/footer'
import { aboutSectionLabel } from '~/features/about/settings'
const { t } = useI18n()
const year = new Date().getFullYear()
const props = defineProps<{
  value: Omit<SiteSettingsData, 'revision' | 'updatedAt' | 'announcementUpdatedAt'>
  label: string
}>()
const hiddenSuffix = (visible: boolean) => (visible ? '' : t('admin-system.sitePreview.hiddenSuffix'))
const navigationText = computed(() =>
  (props.value.navigation ?? [])
    .map((entry) =>
      entry.type === 'route'
        ? `${navRouteCatalog[entry.key]?.label ?? entry.key}${hiddenSuffix(entry.visible)}`
        : `${entry.label}↗${hiddenSuffix(entry.visible)}`,
    )
    .join(' · '),
)
const imageFailed = ref(false)
const imageAttempt = ref(0)
function retryAvatar() {
  imageFailed.value = false
  imageAttempt.value += 1
}
watch(
  () => props.value.avatar,
  () => {
    imageFailed.value = false
  },
)
</script>
<style scoped>
.site-preview {
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  overflow-wrap: anywhere;
}
h2 {
  font-size: 1.1rem;
  margin-bottom: 1rem;
}
h3 {
  font-weight: 700;
}
p,
ul {
  margin-block: 0.6rem;
}
.site-preview__about {
  margin-block: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border);
}
summary {
  cursor: var(--interaction-cursor, pointer);
  font-weight: 600;
}
.site-preview__about section {
  margin-block: 1rem;
}
.site-preview__about li {
  margin-block: 0.75rem;
}
.site-preview__about p {
  white-space: pre-wrap;
}
img {
  border-radius: 50%;
  object-fit: cover;
}
ul {
  list-style: none;
  padding: 0;
}
</style>
