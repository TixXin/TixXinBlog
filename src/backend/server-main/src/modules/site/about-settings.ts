/** @file about-settings.ts @description 关于页可维护资料；排序由数组顺序决定，公开读取剔除隐藏条目 */
import { Type } from 'class-transformer'
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsString, MaxLength, ValidateNested } from 'class-validator'

export class AboutItemDto {
  @IsString() @MaxLength(120) title!: string
  @IsString() @MaxLength(1000) detail!: string
  @IsString() @MaxLength(80) period!: string
  @IsBoolean() visible!: boolean
}
export class AboutSectionDto {
  @IsIn(['experience', 'skill', 'interest', 'reading']) kind!: 'experience' | 'skill' | 'interest' | 'reading'
  @IsBoolean() visible!: boolean
  @IsArray() @ArrayMaxSize(30) @ValidateNested({ each: true }) @Type(() => AboutItemDto) items!: AboutItemDto[]
}
export class AboutSettingsDto {
  @IsBoolean() visible!: boolean
  @IsString() @MaxLength(5000) introduction!: string
  @IsArray() @ArrayMaxSize(4) @ValidateNested({ each: true }) @Type(() => AboutSectionDto) sections!: AboutSectionDto[]
}
export function emptyAbout(): AboutSettingsDto {
  return { visible: false, introduction: '', sections: [] }
}
export function publicAbout(value: AboutSettingsDto | undefined): AboutSettingsDto {
  if (!value?.visible) return emptyAbout()
  return {
    visible: true,
    introduction: value.introduction,
    sections: value.sections
      .filter((section) => section.visible)
      .map((section) => ({ ...section, items: section.items.filter((item) => item.visible && item.title.trim()) }))
      .filter((section) => section.items.length),
  }
}
