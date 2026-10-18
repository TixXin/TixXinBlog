<!--
  @file about.vue
  @description 关于我页面，展示个人信息、技能、经历和联系方式
  @author TixXin
  @since 2025-03-17
-->

<template>
  <div class="main-inner">
    <CommonCustomScrollbar class="about-body" viewport-class="about-viewport" :show-back-to-top="false" primary>
      <AboutHero :profile="profile" />
      <AboutProfileContent :value="settings.about" />
      <AboutContactCards v-if="contacts.length" :contacts="contacts" />
    </CommonCustomScrollbar>
    <ClientOnly>
      <Teleport to="#right-sidebar-target">
        <SidebarRightSidebar>
          <AboutDonateCard />
        </SidebarRightSidebar>
      </Teleport>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import { socialProfiles } from '~/utils/absoluteUrl'
const { settings } = useSiteSettings()

const siteUrl = useSiteUrl()
const aboutDescription = computed(() => settings.value.ownerTitle || settings.value.description)
usePageSeo({
  title: '关于我',
  shareTitle: () => `关于我 - ${settings.value.name}`,
  description: () => aboutDescription.value,
  type: 'profile',
})
const profileImage = useDefaultShareImage()
useJsonLd('profile', () => {
  const sameAs = socialProfiles(settings.value.socials)
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    url: `${siteUrl}/about`,
    name: `关于我 - ${settings.value.name}`,
    inLanguage: 'zh-CN',
    mainEntity: {
      '@type': 'Person',
      '@id': `${siteUrl}/#person`,
      name: settings.value.ownerName || settings.value.name,
      url: `${siteUrl}/about`,
      ...(aboutDescription.value ? { description: aboutDescription.value } : {}),
      ...(settings.value.ownerTitle ? { jobTitle: settings.value.ownerTitle } : {}),
      ...(profileImage.value ? { image: profileImage.value.url } : {}),
      ...(sameAs.length ? { sameAs } : {}),
    },
  }
})

const { ownerCard } = useSiteInfo()
const profile = computed(() => ({
  name: ownerCard.value.name,
  avatar: ownerCard.value.avatar || '/avatar.svg',
  bio: ownerCard.value.title,
  socials: ownerCard.value.socials,
}))
const contacts = computed(() =>
  ownerCard.value.socials.map((link) => ({
    icon: link.icon,
    type: link.label,
    value: link.href.replace(/^mailto:|^https?:\/\//, ''),
    href: link.href,
  })),
)
</script>

<style lang="scss" scoped>
.about-body {
  flex: 1;
  padding: 0;
}

:deep(.about-viewport) {
  padding: 1rem 2rem 2rem;
}
</style>
