/**
 * @file batch-post.dto.ts
 * @description 文章批量操作请求：最多 50 个明确 ID 和版本，执行需要短期预览凭证。
 */
import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator'
export const POST_BATCH_ACTIONS = ['withdraw', 'archive', 'trash', 'restore', 'delete'] as const
export type PostBatchAction = (typeof POST_BATCH_ACTIONS)[number]
export class PostSelectionDto {
  @IsInt() @Min(1) id!: number
  @IsInt() @Min(0) revision!: number
}
export class PreviewPostBatchDto {
  @IsIn(POST_BATCH_ACTIONS) action!: PostBatchAction
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ArrayUnique((item: PostSelectionDto | null) => item?.id)
  @ValidateNested({ each: true })
  @Type(() => PostSelectionDto)
  items!: PostSelectionDto[]
}
export class ExecutePostBatchDto {
  @IsUUID('4') ticket!: string
  @IsOptional() @IsString() @MaxLength(32) acknowledgement?: string
}
