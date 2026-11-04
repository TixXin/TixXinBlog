/** @file 20261105060000_add_site_traffic.ts @description 新增按日访问构成表（页面、来源域名、设备），并为每日统计补稳定标识；只存汇总数字 */
import { Migration } from '@mikro-orm/migrations'
export class Migration20261105060000_add_site_traffic extends Migration {
  override async up(): Promise<void> {
    // 每日统计补应用层标识：已有行就地生成，之后由写入方提供。
    this.addSql(`alter table "site_daily_stats" add column "id" uuid null;`)
    this.addSql(`update "site_daily_stats" set "id" = gen_random_uuid() where "id" is null;`)
    this.addSql(`alter table "site_daily_stats" alter column "id" set not null;`)
    this.addSql(`alter table "site_daily_stats" add constraint "site_daily_stats_id_unique" unique ("id");`)
    this.addSql(
      `create table "site_traffic_daily" ("id" uuid not null, "day" date not null, "dimension" text not null, "key" text not null, "count" int not null default 0, constraint "site_traffic_daily_pkey" primary key ("id"));`,
    )
    this.addSql(
      `alter table "site_traffic_daily" add constraint "site_traffic_daily_day_dimension_key_unique" unique ("day", "dimension", "key");`,
    )
  }
  override async down(): Promise<void> {
    // 访问构成是运行统计，回退时可删除；每日统计只去掉补充的标识列，数字保留。
    this.addSql(`drop table if exists "site_traffic_daily" cascade;`)
    this.addSql(`alter table "site_daily_stats" drop constraint "site_daily_stats_id_unique";`)
    this.addSql(`alter table "site_daily_stats" drop column "id";`)
  }
}
