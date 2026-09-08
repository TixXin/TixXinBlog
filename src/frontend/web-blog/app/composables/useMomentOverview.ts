/**
 * @file useMomentOverview.ts
 * @description 朋友圈各入口共用站点作者资料与示例数据统计，避免使用占位联系方式和实时状态
 * @author TixXin
 * @since 2026-09-07
 */
export function useMomentOverview() {
  const { list: moments } = useMomentList()
  const { ownerCard } = useSiteInfo()
  const authorStats = computed(() => ({
    totalMoments: moments.value.length,
    totalLikes: moments.value.reduce((sum, moment) => sum + moment.likes, 0),
    totalComments: moments.value.reduce((sum, moment) => sum + (moment.comments?.length ?? 0), 0),
    currentMood: '示例数据统计',
    moodUpdatedAt: '不含临时互动',
    socialLinks: ownerCard.value.socials.map((link) => ({ icon: link.icon, url: link.href, label: link.label })),
  }))
  return { moments, authorStats, ownerCard }
}
