/**
 * @file 03.static-media.ts
 * @description 静态发布形态下，受管图片的宽度变体改用构建时导出的独立文件；服务端预渲染与浏览器一致，服务器部署不受影响
 */
import { enableStaticImageVariants } from '~/utils/managedImage'

export default defineNuxtPlugin({
  name: 'static-media',
  setup() {
    if (useRuntimeConfig().public.staticSite) enableStaticImageVariants(true)
  },
})
