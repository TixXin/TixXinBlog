/** @file subscription.dto.ts @description 订阅查询与管理写入白名单，历史和系统字段不能从普通更新覆盖 */
import { Transform, Type } from 'class-transformer'
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator'
import {
  BILLING_CYCLES,
  CURRENCIES,
  MAX_AMOUNT,
  PUBLICATION_STATUSES,
  SUBSCRIPTION_CATEGORIES,
  SUBSCRIPTION_STATUSES,
} from '@tixxin/subscription-domain'
import type {
  BillingCycle,
  Currency,
  PublicationStatus,
  SubscriptionCategory,
  SubscriptionStatus,
} from '@tixxin/subscription-domain'
import { MaxUtf16Length } from '../../common/validators/max-utf16-length'
import { numberFromString } from '../../common/transforms/number-from-string'
const provided = (_object: unknown, value: unknown) => value !== undefined
const nullable = (_object: unknown, value: unknown) => value !== undefined && value !== null
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)
export class SubscriptionQuery {
  @Type(() => Number) @IsInt() @Min(1) @Max(10000) page = 1
  @Type(() => Number) @IsInt() @Min(1) @Max(48) pageSize = 12
  @ValidateIf(provided) @IsString() @MaxLength(200) @Transform(trim) q?: string
  @ValidateIf(provided) @IsIn(SUBSCRIPTION_CATEGORIES) category?: SubscriptionCategory
  @ValidateIf(provided) @IsIn(CURRENCIES) currency?: Currency
  @ValidateIf(provided) @IsIn(SUBSCRIPTION_STATUSES) subscriptionStatus?: SubscriptionStatus
  @ValidateIf(provided) @IsIn(['manual', 'name', 'amount-asc', 'amount-desc']) sort?:
    'manual' | 'name' | 'amount-asc' | 'amount-desc'
}
export class AdminSubscriptionQuery extends SubscriptionQuery {
  @ValidateIf(provided) @IsIn(['all', ...PUBLICATION_STATUSES]) status?: PublicationStatus | 'all'
}
export class SaveSubscriptionDto {
  @ValidateIf(provided) @IsUUID('4') requestId?: string
  @ValidateIf(provided) @IsInt() @Min(0) @Max(2147483647) revision?: number
  @ValidateIf(provided) @IsString() @MinLength(1) @MaxUtf16Length(160) @Transform(trim) name?: string
  @ValidateIf(provided) @IsString() @MaxUtf16Length(5000) @Transform(trim) description?: string
  @ValidateIf(nullable) @IsString() @MaxLength(2048) url?: string | null
  @ValidateIf(nullable) @IsString() @MaxUtf16Length(160) @Transform(trim) platform?: string | null
  @ValidateIf(provided) @IsIn(SUBSCRIPTION_CATEGORIES) category?: SubscriptionCategory
  @ValidateIf(provided) @IsIn(CURRENCIES) currency?: Currency
  @ValidateIf(provided) @IsInt() @Min(0) @Max(MAX_AMOUNT) amount?: number
  @ValidateIf(provided) @IsIn(BILLING_CYCLES) billingCycle?: BillingCycle
  @ValidateIf(nullable) @IsString() @MaxLength(10) startDate?: string | null
  @ValidateIf(nullable) @IsString() @MaxLength(10) nextBillingDate?: string | null
  @ValidateIf(provided) @IsIn(SUBSCRIPTION_STATUSES) subscriptionStatus?: SubscriptionStatus
  @ValidateIf(provided) @IsString() @MaxUtf16Length(5000) notes?: string
  @ValidateIf(nullable) @IsUUID('4') iconMediaId?: string | null
  @ValidateIf(provided) @IsIn(PUBLICATION_STATUSES) status?: PublicationStatus
  @ValidateIf(provided) @IsInt() @Min(-1000000) @Max(1000000) sortOrder?: number
  @ValidateIf(provided) @IsString() @MaxUtf16Length(500) @Transform(trim) priceChangeReason?: string
}
export class SubscriptionRevisionDto {
  @Transform(numberFromString) @IsInt() @Min(0) @Max(2147483647) revision!: number
}
export class SubscriptionSortItemDto extends SubscriptionRevisionDto {
  @IsInt() @Min(1) @Max(2147483647) id!: number
  @IsInt() @Min(-1000000) @Max(1000000) sortOrder!: number
}
export class SubscriptionSortDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(48)
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => SubscriptionSortItemDto)
  items!: SubscriptionSortItemDto[]
}
export class FetchFaviconDto {
  @IsString() @MinLength(1) @MaxLength(2048) url!: string
  @ValidateIf(provided) @IsBoolean() force?: boolean
}
