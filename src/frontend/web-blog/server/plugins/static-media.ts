/**
 * @file static-media.ts
 * @description 静态发布构建时，订阅源等 Nitro 路由渲染的受管图片同样使用独立的宽度变体文件；服务器部署不受影响
 */
import { enableStaticImageVariants } from '~/utils/managedImage'

export default defineNitroPlugin(() => {
  if (useRuntimeConfig().public.staticSite) enableStaticImageVariants(true)
})
