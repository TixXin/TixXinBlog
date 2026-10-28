/** @file useStaticSite.ts @description 当前是否为静态发布形态：没有后端与访客身份，互动、登录与外观切换入口按此隐藏 */
export function useStaticSite() {
  return useRuntimeConfig().public.staticSite === true
}
