/** @file 20261104155508_add_site_presence.ts @description 新增实时在线与访问统计的运行配置、匿名访客与每日汇总表；开关默认开启，统计从零开始 */
import { Migration } from '@mikro-orm/migrations'
export class Migration20261104155508_add_site_presence extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table "site_presence" ("id" text not null, "auto_presence" boolean not null default true, "public_stats" boolean not null default true, "owner_last_seen_at" timestamptz null, "updated_at" timestamptz not null, constraint "site_presence_pkey" primary key ("id"));`,
    )
    // 只存访客 ID 的哈希与北京时间日期，不存 IP、User-Agent 或访问路径。
    this.addSql(
      `create table "site_visitor" ("visitor_hash" text not null, "first_seen_at" timestamptz not null, "last_seen_day" date not null, constraint "site_visitor_pkey" primary key ("visitor_hash"));`,
    )
    this.addSql(
      `create table "site_daily_stats" ("day" date not null, "views" int not null default 0, "visitors" int not null default 0, constraint "site_daily_stats_pkey" primary key ("day"));`,
    )
    this.addSql(
      `insert into "site_presence" ("id", "auto_presence", "public_stats", "owner_last_seen_at", "updated_at") values ('default', true, true, null, now()) on conflict ("id") do nothing;`,
    )
  }
  override async down(): Promise<void> {
    // 均为运行统计，回退时可删除；不影响内容数据。
    this.addSql(`drop table if exists "site_daily_stats" cascade;`)
    this.addSql(`drop table if exists "site_visitor" cascade;`)
    this.addSql(`drop table if exists "site_presence" cascade;`)
  }
}
