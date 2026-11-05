/** @file 20261105180625_subscription_schedule_settings.ts @description 订阅新增试用到期日与结束日，并新增参考汇率与续费日历令牌的运行配置表；禁止破坏性回退 */
import { Migration } from '@mikro-orm/migrations'

export class Migration20261105180625_subscription_schedule_settings extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table "subscription_settings" ("id" text not null, "base_currency" text null, "rates" jsonb not null default '{}', "rates_updated_at" date null, "calendar_token_hash" text null, "revision" int not null default 0, "updated_at" timestamptz not null, constraint "subscription_settings_pkey" primary key ("id"));`,
    )
    this.addSql(`alter table "subscription" add column "trial_end_date" date null, add column "end_date" date null;`)
  }

  override async down(): Promise<void> {
    throw new Error('订阅日程迁移不可逆；回退应用时保留试用到期日、结束日与订阅运行配置')
  }
}
