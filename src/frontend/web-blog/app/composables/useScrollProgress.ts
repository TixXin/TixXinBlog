/**
 * @file useScrollProgress.ts
 * @description 全局滚动进度共享状态，供主滚动区域写入、底部栏等消费者读取
 * @author TixXin
 * @since 2026-04-09
 */

import { ref } from 'vue'

const scrollProgress = ref(0)
const scrollResetFn = ref<(() => void) | null>(null)
/** 滚动方向：'up' 普通页面回到顶部，'down' 聊天页面回到底部 */
const scrollDirection = ref<'up' | 'down'>('up')

/**
 * 全局滚动进度 composable
 * - 主滚动条（primary）写入 scrollProgress 和 scrollResetFn
 * - 底部栏等消费者读取并展示
 * - 聊天类页面可覆写 scrollResetFn 和 scrollDirection 为反向
 */
export function useScrollProgress() {
  return {
    /** 滚动进度 0~100 */
    scrollProgress,
    /** 当前活跃滚动条的回到起始位置方法 */
    scrollResetFn,
    /** 滚动方向：'up' 回到顶部 / 'down' 回到底部 */
    scrollDirection,
  }
}
