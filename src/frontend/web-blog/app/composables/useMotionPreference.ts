/**
 * @file useMotionPreference.ts
 * @description 读取应用级动效偏好；订阅由客户端插件唯一持有，调用本函数不创建监听
 * @author TixXin
 * @since 2026-09-07
 */
export function useMotionPreference() {
  const reducedMotion = useState('motion-reduced', () => false)
  const motionReady = useState('motion-preference-ready', () => false)
  return { reducedMotion: readonly(reducedMotion), motionReady: readonly(motionReady) }
}
