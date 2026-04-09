/**
 * @file useScrollProgress.ts
 * @description 全局滚动进度共享状态，供主滚动区域写入、底部栏等消费者读取
 * @author TixXin
 * @since 2026-04-09
 */

import { ref } from 'vue'

const scrollProgress = ref(0)
const scrollToTopFn = ref<(() => void) | null>(null)

/**
 * 全局滚动进度 composable
 * - 主滚动条（primary）写入 scrollProgress 和 scrollToTopFn
 * - 底部栏等消费者读取并展示
 */
export function useScrollProgress() {
  return {
    /** 滚动进度 0~100 */
    scrollProgress,
    /** 当前活跃滚动条的回到顶部方法 */
    scrollToTopFn,
  }
}
