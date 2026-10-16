/**
 * @file 20260907180000_add_site_settings.ts
 * @description 新建库写入中性的站点初始资料，不写入任何博主个人身份，也不复制演示公告和虚构运行统计。
 */
import { Migration } from '@mikro-orm/migrations'
export class Migration20260907180000_add_site_settings extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      'create table "site_settings" ("id" text not null, "revision" int not null default 0, "values" jsonb not null, "updated_at" timestamptz not null, constraint "site_settings_pkey" primary key ("id"));',
    )
    this.addSql(
      'create table "site_settings_revision" ("revision" int not null, "values" jsonb not null, "reason" text not null, "created_at" timestamptz not null, constraint "site_settings_revision_pkey" primary key ("revision"));',
    )
    this.addSql(
      `insert into "site_settings" ("id","revision","values","updated_at") values ('default',0,'{"name":"My Blog","description":"","ownerName":"博主","ownerTitle":"","avatar":"/avatar.svg","avatarAlt":"博主头像","seoTitle":"","seoDescription":"","announcement":"","announcementUpdatedAt":"","presenceLabel":"","presenceSignature":"","launchedAt":"","socials":[],"about":{"visible":false,"introduction":"","sections":[]}}',now());`,
    )
    this.addSql(
      `insert into "site_settings_revision" ("revision","values","reason","created_at") select revision,"values",'初始站点资料',updated_at from site_settings;`,
    )
  }
  override async down(): Promise<void> {
    this.addSql('drop table "site_settings_revision";')
    this.addSql('drop table "site_settings";')
  }
}
