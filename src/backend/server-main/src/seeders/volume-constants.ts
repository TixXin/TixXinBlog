/** @file volume-constants.ts @description 容量档标识常量；单独成文件以免保护式清理引入批量生成依赖 */
export const VOLUME_DATASET_PREFIX = 'volume-'
export const VOLUME_DATASET = 'volume-v1'
export const VOLUME_MARK = 'volume-batch'
export const VOLUME_SCALES = { small: 200, large: 2000 } as const
// 评论分页需要少数文章集中承载大量评论；序号避开容量档里的草稿与归档位置。
export const VOLUME_HOT_POSTS = [2, 3, 4] as const
export const VOLUME_HOT_COMMENTS = { small: [60, 30, 15], large: [300, 150, 60] } as const
export type VolumeScale = keyof typeof VOLUME_SCALES
