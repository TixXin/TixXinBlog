/**
 * @file 20261106080000_add_recent_visits.ts
 * @description 新增近期访问明细表（打码 IP、地区、设备、页面与来源，保留 7 天）与 site_presence 的开关列，开关默认关闭，
 *   升级后不改变现有站点的数据收集范围；访问构成的国家与省份维度沿用 site_traffic_daily，不需要改表。
 */
import { Migration } from '@mikro-orm/migrations'
export class Migration20261106080000_add_recent_visits extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table "site_presence" add column "recent_visits" boolean not null default false;`)
    this.addSql(
      `create table "site_recent_visit" ("id" uuid not null, "visited_at" timestamptz not null, "masked_ip" text not null, "country" text not null, "region" text not null, "city" text not null, "device" text not null, "path" text not null, "referrer" text null, constraint "site_recent_visit_pkey" primary key ("id"));`,
    )
    this.addSql(`create index "site_recent_visit_visited_at_index" on "site_recent_visit" ("visited_at");`)
  }
  override async down(): Promise<void> {
    this.addSql(`drop table if exists "site_recent_visit" cascade;`)
    this.addSql(`alter table "site_presence" drop column "recent_visits";`)
  }
}
