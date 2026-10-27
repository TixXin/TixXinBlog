/** @file useAdminLinkApplications.ts @description 友链申请审核页的组合入口：列表读取、审核操作与公开开关分开维护，共用错误与提示 */
export function useAdminLinkApplications() {
  const auth = useCurrentUser()
  const list = { ...useAdminLinkApplicationList(), notice: ref('') }
  return {
    ...list,
    ...useLinkApplicationActions(list),
    ...useLinkApplicationSwitch(list),
    isLoggedIn: auth.isLoggedIn,
    restoringPending: auth.restoringPending,
  }
}
