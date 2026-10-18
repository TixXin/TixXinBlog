/**
 * @file query-post-navigation.dto.ts
 * @description 文章上下篇导航的查询范围：全站、仅同专栏，或同专栏为空时由服务端回退全站（auto）
 */
import { IsIn } from 'class-validator'

export const POST_NAVIGATION_SCOPES = ['all', 'folder', 'auto'] as const
export type PostNavigationScope = (typeof POST_NAVIGATION_SCOPES)[number]

export class QueryPostNavigationDto {
  @IsIn(POST_NAVIGATION_SCOPES)
  scope: PostNavigationScope = 'all'
}
