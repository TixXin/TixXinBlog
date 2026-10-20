/**
 * @file useDevPreview.ts
 * @description 开发预览开关：仅开发模式（及单元测试）读取 ?preview=<名称>，用于查看依赖站点状态（如尚未初始化）的界面；
 *              生产构建中 import.meta.dev 与 import.meta.test 均为 false，判定恒为 false，线上任何参数都不生效
 * @author TixXin
 * @since 2026-10-20
 */
export function useDevPreview() {
  const route = useRoute()
  return (name: string) => (import.meta.dev || import.meta.test) && route.query.preview === name
}
