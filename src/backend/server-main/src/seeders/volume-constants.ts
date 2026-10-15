/** @file volume-constants.ts @description 容量档标识常量；单独成文件以免保护式清理引入批量生成依赖 */
export const VOLUME_DATASET_PREFIX = 'volume-'
export const VOLUME_DATASET = 'volume-v1'
export const VOLUME_MARK = 'volume-batch'
export const VOLUME_SCALES = { small: 200, large: 2000 } as const
export type VolumeScale = keyof typeof VOLUME_SCALES
