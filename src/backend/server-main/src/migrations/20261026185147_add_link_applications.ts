/** @file 20261026185147_add_link_applications.ts @description 新增友链申请表与公开申请开关，开关默认关闭，存量站点行为不变 */
import { Migration } from '@mikro-orm/migrations'
export class Migration20261026185147_add_link_applications extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table "friend_link_application" ("id" uuid not null, "name" text not null, "url" text not null, "description" text not null default '', "contact" text null, "message" text not null default '', "status" text not null default 'pending', "handled_at" timestamptz null, "created_link_id" int null, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "friend_link_application_pkey" primary key ("id"));`,
    )
    // 同一地址同时只保留一条待审申请；已处理的申请不占用地址，被拒绝后可重新提交。
    this.addSql(
      `create unique index "friend_link_application_pending_url_unique" on "friend_link_application" ("url") where "status" = 'pending';`,
    )
    this.addSql(
      `create index "friend_link_application_status_created_idx" on "friend_link_application" ("status", "created_at");`,
    )
    this.addSql(`alter table "link_settings" add column "applications_enabled" boolean not null default false;`)
  }
  override async down(): Promise<void> {
    // 申请只是审核流程数据，通过的申请已另建友链草稿，回退时可删除。
    this.addSql(`drop table if exists "friend_link_application" cascade;`)
    this.addSql(`alter table "link_settings" drop column "applications_enabled";`)
  }
}
