/** @file query-post-navigation.dto.ts @description 文章上下篇导航的全站与同专栏查询范围 */
import { IsIn } from 'class-validator'

export const POST_NAVIGATION_SCOPES = ['all', 'folder'] as const
export type PostNavigationScope = (typeof POST_NAVIGATION_SCOPES)[number]

export class QueryPostNavigationDto {
  @IsIn(POST_NAVIGATION_SCOPES)
  scope: PostNavigationScope = 'all'
}
