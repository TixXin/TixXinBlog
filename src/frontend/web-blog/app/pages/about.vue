<!--
  @file about.vue
  @description 关于我页面：个人信息与网页主页、公开资料、本站信息和联系方式；支持方式在右栏
  @author TixXin
  @since 2025-03-17
-->

<template>
  <div class="main-inner">
    <CommonCustomScrollbar class="about-body" viewport-class="about-viewport" :show-back-to-top="false" primary>
      <AboutHero :profile="profile" />
      <AboutProfileContent :value="settings.about" />
      <AboutSiteInfo v-if="about.showSiteInfo" />
      <AboutContactCards v-if="contacts.length || guestbook" :contacts="contacts" :guestbook="guestbook" />
    </CommonCustomScrollbar>
    <!-- ClientOnly 包裹关系保持原样；右栏是否挂载由能力位门控组件决定 -->
    <ClientOnly>
      <CommonThemeSidebarPortal>
        <SidebarRightSidebar>
          <AboutDonateCard />
        </SidebarRightSidebar>
      </CommonThemeSidebarPortal>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import { socialProfiles } from '~/utils/absoluteUrl'
import { introductionSummary, isWebProfile, localizeAbout, publicAbout } from '~/features/about/settings'
const { settings } = useSiteSettings()
const { t, locale } = useI18n()

const siteUrl = useSiteUrl()
const staticSite = useStaticSite()
const profileImage = useDefaultShareImage()
const about = computed(() => localizeAbout(publicAbout(settings.value.about), locale.value))
// 描述优先取简介第一句，其次头衔与站点描述
const aboutDescription = computed(
  () => introductionSummary(about.value.introduction) || settings.value.ownerTitle || settings.value.description,
)
usePageSeo({
  title: () => t('misc.about.page.title'),
  shareTitle: () => t('misc.about.page.shareTitle', { name: settings.value.name }),
  description: () => aboutDescription.value,
  type: 'profile',
  // 博主头像为位图时作为分享图（方形，用小卡片）；否则沿用全站的站点分享卡片
  image: () => profileImage.value?.url,
  imageAlt: () => profileImage.value?.alt,
  imageCard: 'summary',
})
useRelMeLinks()
useJsonLd('profile', () => {
  const sameAs = socialProfiles(settings.value.socials)
  const name = settings.value.ownerName || settings.value.name
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    url: `${siteUrl}/about`,
    name: t('misc.about.page.shareTitle', { name: settings.value.name }),
    inLanguage: locale.value,
    ...(settings.value.updatedAt ? { dateModified: settings.value.updatedAt } : {}),
    mainEntity: {
      '@type': 'Person',
      '@id': `${siteUrl}/#person`,
      name,
      url: `${siteUrl}/about`,
      ...(settings.value.name && settings.value.name !== name ? { alternateName: settings.value.name } : {}),
      ...(aboutDescription.value ? { description: aboutDescription.value } : {}),
      ...(settings.value.ownerTitle ? { jobTitle: settings.value.ownerTitle } : {}),
      ...(profileImage.value ? { image: profileImage.value.url } : {}),
      ...(sameAs.length ? { sameAs } : {}),
    },
  }
})

const { ownerCard } = useSiteInfo()
// 网页主页放在顶部并声明 rel="me"；邮箱等其他渠道放在联系卡片，两处不重复
const profile = computed(() => ({
  name: ownerCard.value.name,
  avatar: ownerCard.value.avatar || '/avatar.svg',
  avatarAlt: ownerCard.value.avatarAlt ?? '',
  bio: ownerCard.value.title,
  socials: ownerCard.value.socials.filter((link) => isWebProfile(link.href)),
}))
const contacts = computed(() =>
  ownerCard.value.socials
    .filter((link) => !isWebProfile(link.href))
    .map((link) => ({
      icon: link.icon,
      type: link.label,
      value: link.href.replace(/^mailto:/, ''),
      href: link.href,
    })),
)
// 留言板入口：静态发布没有后端；博主在导航里隐藏留言板时也不引导过去
const guestbook = computed(
  () =>
    !staticSite &&
    (settings.value.navigation ?? []).some((item) => item.type === 'route' && item.key === 'guestbook' && item.visible),
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
