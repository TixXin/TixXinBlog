/** @file 20261013010000_add_subscriptions.ts @description 新增订阅费用、价格历史和受管图标引用，禁止破坏性回退 */
import { Migration } from '@mikro-orm/migrations'
export class Migration20261013010000_add_subscriptions extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table "subscription" ("id" serial primary key, "name" text not null, "description" text not null default '', "url" text null, "platform" text null, "category" text not null default 'other', "currency" text not null, "amount" int not null, "billing_cycle" text not null, "start_date" date null, "next_billing_date" date null, "subscription_status" text not null default 'active', "notes" text not null default '', "icon_media_id" uuid null, "favicon_domain" text null, "price_history" jsonb not null default '[]', "status" text not null default 'draft', "sort_order" int not null default 0, "revision" int not null default 0, "request_id" text null, "request_hash" text null, "published_at" timestamptz null, "deleted_at" timestamptz null, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "subscription_amount_check" check (amount >= 0));`,
    )
    this.addSql(
      `create index "subscription_visibility_order_idx" on "subscription" ("status", "deleted_at", "sort_order", "id");`,
    )
    this.addSql(
      `create index "subscription_filters_idx" on "subscription" ("status", "currency", "category", "subscription_status");`,
    )
    this.addSql(`alter table "subscription" add constraint "subscription_request_id_unique" unique ("request_id");`)
    this.addSql(
      `alter table "subscription" add constraint "subscription_icon_media_id_foreign" foreign key ("icon_media_id") references "media_asset" ("id") on update cascade on delete restrict;`,
    )
    this.addSql(`alter table "media_reference" add column "subscription_id" int null;`)
    this.addSql(
      `alter table "media_reference" add constraint "media_reference_subscription_id_foreign" foreign key ("subscription_id") references "subscription" ("id") on update cascade on delete cascade;`,
    )
  }
  override async down(): Promise<void> {
    throw new Error('订阅迁移不可逆；回退应用时保留订阅数据、价格历史与媒体关系')
  }
}
